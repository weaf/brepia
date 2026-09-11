import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
} from '../shared/brepProject.ts';
import {
  brepAiBuildInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';

const grasshopperFixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

function booleanProject(type: 'union' | 'intersect'): BrepProject {
  return {
    schemaVersion: 1,
    id: `m2${type}`,
    name: `M2 ${type}`,
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [],
    nodes: [
      { id: 'outer', type: 'box', width: 20, depth: 20, height: 20 },
      { id: 'inner', type: 'box', width: 10, depth: 10, height: 10 },
      { id: 'booleanResult', type, inputs: ['outer', 'inner'] },
    ],
    resultNodeId: 'booleanResult',
  };
}

function expectProjectError(
  operation: () => unknown,
  code: BrepProjectError['code'],
): void {
  assert.throws(
    operation,
    (error: unknown) => error instanceof BrepProjectError && error.code === code,
  );
}

function grasshopperBooleanFixture(type: 'union' | 'intersect') {
  const fixture = JSON.parse(JSON.stringify(grasshopperFixture)) as {
    source: {
      nodes: Array<Record<string, unknown>>;
      resultNodeId: string;
    };
  } & Record<string, unknown>;
  const body = fixture.source.nodes[0];
  assert.ok(body);
  fixture.source.nodes = [
    body,
    { id: 'innerBody', type: 'box', width: 100, depth: 100, height: 100 },
    {
      id: 'booleanResult',
      type,
      inputs: [String(body.id), 'innerBody'],
    },
  ];
  fixture.source.resultNodeId = 'booleanResult';
  return fixture;
}

describe('M2 Boolean composition', () => {
  it.each(['union', 'intersect'] as const)(
    'normalizes ordered %s inputs without changing schemaVersion 1',
    (type) => {
      const project = normalizeBrepProject(booleanProject(type));
      const node = project.nodes.find((candidate) => candidate.id === 'booleanResult');
      assert.ok(node && node.type === type);
      assert.deepEqual(node.inputs, ['outer', 'inner']);
      assert.equal(project.schemaVersion, 1);
    },
  );

  it.each(['union', 'intersect'] as const)(
    'requires at least two unique %s input references',
    (type) => {
      const tooShort = booleanProject(type);
      const shortNode = tooShort.nodes.find(
        (candidate) => candidate.id === 'booleanResult',
      );
      assert.ok(shortNode && shortNode.type === type);
      shortNode.inputs = ['outer'];
      expectProjectError(() => normalizeBrepProject(tooShort), 'invalid_node');

      const duplicate = booleanProject(type);
      const duplicateNode = duplicate.nodes.find(
        (candidate) => candidate.id === 'booleanResult',
      );
      assert.ok(duplicateNode && duplicateNode.type === type);
      duplicateNode.inputs = ['outer', 'outer'];
      expectProjectError(() => normalizeBrepProject(duplicate), 'invalid_node');
    },
  );

  it.each(['union', 'intersect'] as const)(
    'keeps %s inside canonical reference and cycle validation',
    (type) => {
      const missing = booleanProject(type);
      const missingNode = missing.nodes.find(
        (candidate) => candidate.id === 'booleanResult',
      );
      assert.ok(missingNode && missingNode.type === type);
      missingNode.inputs = ['outer', 'missing'];
      expectProjectError(
        () => normalizeBrepProject(missing),
        'invalid_reference',
      );

      const cyclic = booleanProject(type);
      const cyclicNode = cyclic.nodes.find(
        (candidate) => candidate.id === 'booleanResult',
      );
      assert.ok(cyclicNode && cyclicNode.type === type);
      cyclicNode.inputs = ['outer', 'booleanResult'];
      expectProjectError(() => normalizeBrepProject(cyclic), 'cycle');
    },
  );

  it.each(['union', 'intersect'] as const)(
    'accepts %s through both canonical and finite provider authoring schemas',
    async (type) => {
      const input = {
        title: `M2 ${type}`,
        version: 'v1',
        project: booleanProject(type),
      };
      const canonical = await brepAiBuildInputSchema.safeParseAsync(input);
      const provider = await brepAiProviderBuildInputZodSchema.safeParseAsync(input);
      assert.equal(canonical.success, true);
      assert.equal(provider.success, true);
    },
  );

  it('maps union to Rhino 8 BooleanUnion with exact-one-Brep cardinality', async () => {
    const script = await createBrepGrasshopperRhinoScriptPlan(
      grasshopperBooleanFixture('union'),
    );
    assert.match(script.source, /import Rhino\nimport Rhino\.Geometry as rg/);
    assert.match(script.source, /rg\.Brep\.CreateBooleanUnion\(/);
    assert.match(script.source, /brepiaTolerance\)/);
    assert.match(
      script.source,
      /Rhino boolean union for Brepia node booleanResult did not produce exactly one Brep/,
    );
  });

  it('maps n-ary intersection to Rhino 8 BooleanIntersection with final exact-one-Brep cardinality', async () => {
    const script = await createBrepGrasshopperRhinoScriptPlan(
      grasshopperBooleanFixture('intersect'),
    );
    assert.match(script.source, /import Rhino\nimport Rhino\.Geometry as rg/);
    assert.match(script.source, /rg\.Brep\.CreateBooleanIntersection\(/);
    assert.match(script.source, /brepiaTolerance\)/);
    assert.match(
      script.source,
      /Rhino boolean intersection for Brepia node booleanResult did not produce exactly one Brep/,
    );
  });

  it('keeps native OCCT evaluation bounded to an exact single Boolean solid', () => {
    const driver = fs.readFileSync(
      new URL('../scripts/brep/brep_driver.py', import.meta.url),
      'utf8',
    );
    assert.match(driver, /inputs\[0\]\.fuse\(\*inputs\[1:\]\)/);
    assert.match(driver, /inputs\[0\]\.intersect\(\*inputs\[1:\]\)/);
    assert.match(driver, /unsupported_result_cardinality/);
    assert.match(driver, /exactly one is required/);
  });

  it('exposes ordered single-shape Boolean inputs in the structural editor', () => {
    const source = fs.readFileSync(
      new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
      'utf8',
    );
    assert.match(source, /'union'/);
    assert.match(source, /'intersect'/);
    assert.match(source, /OrderedNodeReferencesField/);
    assert.match(source, /Inputs are ordered, unique and single-shape/);
    assert.match(source, /isAllowedReferenceNode\(node, nodeId, 'single'\)/);
    assert.match(source, /values\.length <= 2/);
  });
});
