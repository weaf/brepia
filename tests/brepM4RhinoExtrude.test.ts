import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
import { validateBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhxValidation.ts';
import { createBrepGrasshopperContract } from '../shared/brepGrasshopperContract.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import type { BrepAxis, BrepProfile, BrepProject } from '../shared/brepProject.ts';

function extrudeProject(
  profile: BrepProfile,
  axis: BrepAxis = 'z',
): BrepProject {
  return {
    schemaVersion: 1,
    id: `m4Extrude${axis}`,
    name: `M4 extrude ${axis}`,
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'profileWidth',
        label: 'Profile width',
        type: 'number',
        unit: 'mm',
        default: 60,
        min: 10,
        max: 200,
      },
    ],
    nodes: [
      {
        id: 'extruded',
        type: 'extrude',
        profile,
        axis,
        depth: 30,
      },
    ],
    resultNodeId: 'extruded',
  };
}

function resultOutputAccess(ghx: string): string | undefined {
  const match = ghx.match(
    /<chunk name="OutputParam" index="0">[\s\S]*?<item name="ScriptParamAccess" type_name="gh_int32" type_code="3">(\d+)<\/item>/,
  );
  return match?.[1];
}

describe('M4 Rhino profile extrusion host contract', () => {
  it.each([
    [
      'x',
      /brepiaNode0Plane = rg\.Plane\(rg\.Point3d\(-brepiaNode0Depth \/ 2\.0, 0, 0\), rg\.Vector3d\(0, 1, 0\), rg\.Vector3d\(0, 0, 1\)\)/,
    ],
    [
      'y',
      /brepiaNode0Plane = rg\.Plane\(rg\.Point3d\(0, -brepiaNode0Depth \/ 2\.0, 0\), rg\.Vector3d\(0, 0, 1\), rg\.Vector3d\(1, 0, 0\)\)/,
    ],
    [
      'z',
      /brepiaNode0Plane = rg\.Plane\(rg\.Point3d\(0, 0, -brepiaNode0Depth \/ 2\.0\), rg\.Vector3d\(1, 0, 0\), rg\.Vector3d\(0, 1, 0\)\)/,
    ],
  ] as const)(
    'uses the canonical right-handed %s profile frame and symmetric start plane',
    async (axis, expectedPlane) => {
      const contract = createBrepGrasshopperContract({
        project: extrudeProject(
          {
            type: 'rectangle',
            width: { parameter: 'profileWidth' },
            height: 20,
          },
          axis,
        ),
        sourceRevisionId: `m4-extrude-${axis}`,
      });
      const plan = await createBrepGrasshopperRhinoScriptPlan(contract);

      assert.match(plan.source, expectedPlane);
      assert.match(
        plan.source,
        /brepiaNode0ProfileWidth = float\(brepia_scalar\(ProfileWidth\)\)/,
      );
      assert.match(plan.source, /brepiaNode0ProfileHeight = float\(20\)/);
      assert.match(plan.source, /brepiaNode0Profile = rg\.Rectangle3d\(/);
      assert.match(
        plan.source,
        /brepiaNode0Extrusion = rg\.Extrusion\.Create\(brepiaNode0Profile, brepiaNode0Plane, brepiaNode0Depth, True\)/,
      );
      assert.match(plan.source, /brepiaNode0 = brepiaNode0Extrusion\.ToBrep\(\)/);
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

  it('compiles centered circle profiles through the explicit profile plane', async () => {
    const contract = createBrepGrasshopperContract({
      project: extrudeProject({ type: 'circle', radius: 12 }),
      sourceRevisionId: 'm4-extrude-circle',
    });
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);

    assert.match(plan.source, /brepiaNode0ProfileRadius = float\(12\)/);
    assert.match(
      plan.source,
      /brepiaNode0Profile = rg\.Circle\(brepiaNode0Plane, brepiaNode0ProfileRadius\)\.ToNurbsCurve\(\)/,
    );
  });

  it('closes ordered polyline points explicitly without inventing another profile result kind', async () => {
    const contract = createBrepGrasshopperContract({
      project: extrudeProject({
        type: 'closedPolyline',
        points: [
          { u: -20, v: -10 },
          { u: 20, v: -10 },
          { u: 10, v: 15 },
          { u: -15, v: 20 },
        ],
      }),
      sourceRevisionId: 'm4-extrude-polyline',
    });
    const plan = await createBrepGrasshopperRhinoScriptPlan(contract);

    assert.match(plan.source, /brepiaNode0ProfilePoints = \[/);
    assert.match(
      plan.source,
      /brepiaNode0ProfilePoints\.append\(brepiaNode0ProfilePoints\[0\]\)/,
    );
    assert.match(
      plan.source,
      /brepiaNode0Profile = rg\.PolylineCurve\(brepiaNode0ProfilePoints\)/,
    );
    assert.match(plan.source, /not brepiaNode0Profile\.IsClosed/);
  });

  it('persists extrusion Result as Item access and validates generated GHX', async () => {
    const contract = createBrepGrasshopperContract({
      project: extrudeProject({
        type: 'rectangle',
        width: { parameter: 'profileWidth' },
        height: 20,
      }),
      sourceRevisionId: 'm4-extrude-ghx',
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
