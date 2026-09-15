import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepAxis, BrepProject } from '../shared/brepProject.ts';

function revolveProject(axis: BrepAxis): BrepProject {
  return {
    schemaVersion: 1,
    id: `revolve${axis}`,
    name: `Bounded revolve ${axis}`,
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
        default: 16,
        min: 10,
        max: 30,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'revolve',
        axis,
        profile: {
          type: 'closedPolyline',
          points: [
            { u: -30, v: 8 },
            { u: -30, v: { parameter: 'outerRadius' } },
            { u: -18, v: { parameter: 'outerRadius' } },
            { u: -18, v: 13 },
            { u: 18, v: 13 },
            { u: 18, v: { parameter: 'outerRadius' } },
            { u: 30, v: { parameter: 'outerRadius' } },
            { u: 30, v: 8 },
          ],
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

describe('bounded revolve Rhino/GHX interoperability compiler', () => {
  it.each([
    [
      'x',
      /brepiaNode0Plane = rg\.Plane\(rg\.Point3d\(0, 0, 0\), rg\.Vector3d\(1, 0, 0\), rg\.Vector3d\(0, 1, 0\)\)/,
    ],
    [
      'y',
      /brepiaNode0Plane = rg\.Plane\(rg\.Point3d\(0, 0, 0\), rg\.Vector3d\(0, 1, 0\), rg\.Vector3d\(0, 0, 1\)\)/,
    ],
    [
      'z',
      /brepiaNode0Plane = rg\.Plane\(rg\.Point3d\(0, 0, 0\), rg\.Vector3d\(0, 0, 1\), rg\.Vector3d\(1, 0, 0\)\)/,
    ],
  ] as const)(
    'uses the locked %s U-axial/V-radial profile frame',
    async (axis, expectedPlane) => {
      const contract = createBrepGrasshopperContract({
        project: revolveProject(axis),
        sourceRevisionId: `revolve-${axis}`,
      });
      const plan = await createBrepGrasshopperRhinoScriptPlan(contract);

      assert.match(plan.source, expectedPlane);
      assert.match(plan.source, /brepiaNode0ProfileUV = \[/);
      assert.match(plan.source, /item\[1\] < 0\.0/);
      assert.match(plan.source, /brepiaNode0AxisContact = any\(/);
      assert.match(
        plan.source,
        /brepiaNode0ProfilePoints = \[brepiaNode0Plane\.PointAt\(item\[0\], item\[1\]\) for item in brepiaNode0ProfileUV\]/,
      );
      assert.match(
        plan.source,
        /brepiaNode0RevSurface = rg\.RevSurface\.Create\(brepiaNode0Profile, brepiaNode0Axis\)/,
      );
      assert.match(
        plan.source,
        /brepiaNode0 = rg\.Brep\.CreateFromRevSurface\(brepiaNode0RevSurface, False, False\)/,
      );
      assert.match(plan.source, /if brepiaNode0 is None or not brepiaNode0\.IsSolid:/);
      assert.match(
        plan.source,
        /Result = brepia_place_brep\(brepiaNode0, brepiaTransform\)/,
      );
      assert.doesNotMatch(
        plan.source,
        /Result = \[brepia_place_brep\(brepiaResultItem/,
      );
    },
  );

  it('keeps revolve Result as Item access and generated GHX inside the strict validation boundary', async () => {
    const contract = createBrepGrasshopperContract({
      project: revolveProject('z'),
      sourceRevisionId: 'revolve-ghx',
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
