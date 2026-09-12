import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH,
  brepAiBuildProviderInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';

const featureEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
  'utf8',
);
const buildInstruction = fs.readFileSync(
  new URL('../config/ai/instructions/tool-build-brep-project.md', import.meta.url),
  'utf8',
);

function providerRevolveInput() {
  return {
    title: 'Provider revolve fixture',
    version: 'v1',
    project: {
      schemaVersion: 1,
      id: 'providerRevolve',
      name: 'Provider revolve',
      units: 'mm',
      placement: {
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
      },
      parameters: [
        {
          id: 'outerRadius',
          label: 'Outer radius',
          type: 'number',
          unit: 'mm',
          default: 18,
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'revolve',
          axis: 'z',
          profile: {
            type: 'closedPolyline',
            points: [
              { u: -20, v: 8 },
              { u: -20, v: { parameter: 'outerRadius' } },
              { u: 20, v: { parameter: 'outerRadius' } },
              { u: 20, v: 8 },
            ],
          },
        },
      ],
      resultNodeId: 'body',
    },
  };
}

describe('bounded revolve provider and structural authoring surface', () => {
  it('exposes only the bounded canonical revolve fields through the provider schema', async () => {
    expect(BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH).toBe(2);
    expect(
      brepAiProviderBuildInputZodSchema.safeParse(providerRevolveInput()).success,
    ).toBe(true);

    const withAngle = structuredClone(providerRevolveInput());
    Object.assign(withAngle.project.nodes[0], { angleDeg: 180 });
    expect(brepAiProviderBuildInputZodSchema.safeParse(withAngle).success).toBe(
      false,
    );

    const serialized = JSON.stringify(
      await Promise.resolve(brepAiBuildProviderInputSchema.jsonSchema),
    );
    expect(serialized).toContain('"revolve"');
  });

  it('gives the model the locked axial/radial full-revolve contract', () => {
    assert.match(buildInstruction, /full 360 degrees is implicit/i);
    assert.match(buildInstruction, /profile `u` is the axial coordinate/i);
    assert.match(buildInstruction, /profile `v` is non-negative radial distance/i);
    assert.match(buildInstruction, /must keep `v >= 0`/i);
    assert.match(buildInstruction, /no angle, start-angle or partial-sweep field/i);
  });

  it('creates a valid closed-polyline revolve draft and exposes the exact X/Y/Z frame labels', () => {
    assert.match(featureEditorSource, /'revolve'/);
    assert.match(featureEditorSource, /return 'Revolve'/);
    assert.match(featureEditorSource, /profile: defaultRevolveProfile\(\)/);
    assert.match(featureEditorSource, /Revolve axis/);
    assert.match(featureEditorSource, /X axis · U=X axial, V=Y radial/);
    assert.match(featureEditorSource, /Y axis · U=Y axial, V=Z radial/);
    assert.match(featureEditorSource, /Z axis · U=Z axial, V=X radial/);
    assert.match(featureEditorSource, /full 360° single-solid operation/);
    assert.match(featureEditorSource, /V is non-negative radial/);
  });
});
