import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepAxis, BrepProject } from '../shared/brepProject.ts';

function sweepProject(planeNormalAxis: BrepAxis): BrepProject {
  return {
    schemaVersion: 1,
    id: `sweepRhino${planeNormalAxis}`,
    name: `Bounded sweep Rhino ${planeNormalAxis}`,
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
          planeNormalAxis,
          firstLegLength: 1000,
          secondLegLength: 700,
          bendRadius: { parameter: 'bendRadius' },
        },
      },
    ],
    resultNodeId: 'body',
  };
}

function resultOutputAccess(ghx: string): string | undefined {
  const match = ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  );
  return match?.[1];
}

describe('bounded planar elbow sweep Rhino/GHX interoperability compiler', () => {
  it.each([
    [
      'x',
      /brepiaNode0P1 = rg\.Point3d\(0, brepiaNode0FirstLegLength, 0\)/,
      /brepiaNode0P2 = rg\.Point3d\(0, brepiaNode0FirstLegLength \+ brepiaNode0BendRadius, brepiaNode0BendRadius\)/,
      /brepiaNode0SectionPlane = rg\.Plane\(brepiaNode0P0, rg\.Vector3d\(0, 0, 1\), rg\.Vector3d\(1, 0, 0\)\)/,
    ],
    [
      'y',
      /brepiaNode0P1 = rg\.Point3d\(0, 0, brepiaNode0FirstLegLength\)/,
      /brepiaNode0P2 = rg\.Point3d\(brepiaNode0BendRadius, 0, brepiaNode0FirstLegLength \+ brepiaNode0BendRadius\)/,
      /brepiaNode0SectionPlane = rg\.Plane\(brepiaNode0P0, rg\.Vector3d\(1, 0, 0\), rg\.Vector3d\(0, 1, 0\)\)/,
    ],
    [
      'z',
      /brepiaNode0P1 = rg\.Point3d\(brepiaNode0FirstLegLength, 0, 0\)/,
      /brepiaNode0P2 = rg\.Point3d\(brepiaNode0FirstLegLength \+ brepiaNode0BendRadius, brepiaNode0BendRadius, 0\)/,
      /brepiaNode0SectionPlane = rg\.Plane\(brepiaNode0P0, rg\.Vector3d\(0, 1, 0\), rg\.Vector3d\(0, 0, 1\)\)/,
    ],
  ] as const)(
    'uses the locked %s U/V/N path and section frame',
    async (axis, expectedP1, expectedP2, expectedSectionPlane) => {
      const contract = createBrepGrasshopperContract({
        project: sweepProject(axis),
        sourceRevisionId: `sweep-${axis}`,
      });
      const plan = await createBrepGrasshopperRhinoScriptPlan(contract);

      assert.match(plan.source, expectedP1);
      assert.match(plan.source, expectedP2);
      assert.match(plan.source, expectedSectionPlane);
      assert.match(
        plan.source,
        /brepiaNode0Arc = rg\.Arc\(brepiaNode0P1, rg\.Vector3d\([^)]+\), brepiaNode0P2\)/,
      );
      assert.match(plan.source, /brepiaNode0Rail = rg\.PolyCurve\(\)/);
      assert.match(
        plan.source,
        /brepiaNode0Parts = rg\.Brep\.CreateFromSweep\(brepiaNode0Rail, brepiaNode0Profile, False, brepiaTolerance\)/,
      );
      assert.match(
        plan.source,
        /brepiaNode0 = brepiaNode0Parts\[0\]\.CapPlanarHoles\(brepiaTolerance\)/,
      );
      assert.match(
        plan.source,
        /if brepiaNode0 is None or not brepiaNode0\.IsValid or not brepiaNode0\.IsSolid:/,
      );
      assert.match(
        plan.source,
        /Result = brepia_place_brep\(brepiaNode0, brepiaTransform\)/,
      );
    },
  );

  it('keeps sweep Result as Item access and generated GHX inside the strict return boundary', async () => {
    const contract = createBrepGrasshopperContract({
      project: sweepProject('z'),
      sourceRevisionId: 'sweep-ghx',
    });
    assert.equal(contract.interface.outputs[0]?.access, 'item');

    const ghx = await compileBrepGrasshopperExecutableGhx(contract);
    assert.equal(resultOutputAccess(ghx), '0');

    const validation = await validateBrepGrasshopperExecutableGhx(
      ghx,
      contract,
      'generated',
    );
    assert.equal(validation.accepted, true);
    assert.deepEqual(validation.diagnostics, []);
  });
});
