import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH,
  brepAiBuildProviderInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';

const featureEditorSource = [
  fs.readFileSync(
    new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
    'utf8',
  ),
  fs.readFileSync(
    new URL(
      '../src/components/brep/BrepFeatureEditorLegacy.tsx',
      import.meta.url,
    ),
    'utf8',
  ),
].join('\n');

const buildInstruction = fs.readFileSync(
  new URL(
    '../config/ai/instructions/tool-build-brep-project.md',
    import.meta.url,
  ),
  'utf8',
);

function providerSweepInput() {
  return {
    title: 'Provider sweep fixture',
    version: 'v1',
    project: {
      schemaVersion: 1,
      id: 'providerSweep',
      name: 'Provider bounded sweep',
      units: 'mm',
      placement: {
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
      },
      parameters: [
        {
          id: 'tubeDiameter',
          label: 'Tube diameter',
          type: 'number',
          unit: 'mm',
          default: 40,
        },
        {
          id: 'bendRadius',
          label: 'Bend radius',
          type: 'number',
          unit: 'mm',
          default: 150,
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'sweep',
          profile: {
            type: 'circle',
            radius: {
              op: 'div',
              args: [{ parameter: 'tubeDiameter' }, 2],
            },
          },
          path: {
            type: 'planarElbow90',
            planeNormalAxis: 'z',
            firstLegLength: 1000,
            secondLegLength: 700,
            bendRadius: { parameter: 'bendRadius' },
          },
        },
      ],
      resultNodeId: 'body',
    },
  };
}

describe('bounded sweep provider and structural authoring surface', () => {
  it('exposes only the locked finite sweep schema through the provider boundary', async () => {
    expect(BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH).toBe(2);
    expect(
      brepAiProviderBuildInputZodSchema.safeParse(providerSweepInput()).success,
    ).toBe(true);

    const withAngle = structuredClone(providerSweepInput());
    Object.assign(withAngle.project.nodes[0]!.path, { angleDeg: 90 });
    expect(brepAiProviderBuildInputZodSchema.safeParse(withAngle).success).toBe(
      false,
    );

    const withRectangle = structuredClone(providerSweepInput()) as ReturnType<
      typeof providerSweepInput
    >;
    Object.assign(withRectangle.project.nodes[0]!, {
      profile: { type: 'rectangle', width: 20, height: 20 },
    });
    expect(
      brepAiProviderBuildInputZodSchema.safeParse(withRectangle).success,
    ).toBe(false);

    const serialized = JSON.stringify(
      await Promise.resolve(brepAiBuildProviderInputSchema.jsonSchema),
    );
    expect(serialized).toContain('"sweep"');
    expect(serialized).toContain('"planarElbow90"');
  });

  it('gives the model the locked circle-only tangent-elbow contract', () => {
    assert.match(buildInstruction, /exactly one planar 90-degree elbow path/i);
    assert.match(
      buildInstruction,
      /two leg lengths are the straight portions only/i,
    );
    assert.match(buildInstruction, /bendRadius.*centerline radius/i);
    assert.match(
      buildInstruction,
      /section radius must remain strictly smaller/i,
    );
    assert.match(buildInstruction, /do not approximate.*boxes\/cylinders/i);
    assert.match(buildInstruction, /do not invent arbitrary path points/i);
  });

  it('creates and edits only the five bounded sweep controls', () => {
    assert.match(featureEditorSource, /'sweep'/);
    assert.match(featureEditorSource, /return '90° circular sweep'/);
    assert.match(featureEditorSource, /type: 'planarElbow90'/);
    assert.match(featureEditorSource, /planeNormalAxis: 'z'/);
    assert.match(featureEditorSource, /Circular profile radius/);
    assert.match(featureEditorSource, /Path plane normal axis/);
    assert.match(featureEditorSource, /First straight leg length/);
    assert.match(featureEditorSource, /Second straight leg length/);
    assert.match(featureEditorSource, /Bend centerline radius/);
    assert.match(featureEditorSource, /X normal · U=Y, V=Z/);
    assert.match(featureEditorSource, /Y normal · U=Z, V=X/);
    assert.match(featureEditorSource, /Z normal · U=X, V=Y/);
    assert.match(featureEditorSource, /No arbitrary\s+paths or twist controls/);
    assert.doesNotMatch(featureEditorSource, /Sweep angle/);
    assert.doesNotMatch(featureEditorSource, /Guide rail/);
  });
});
