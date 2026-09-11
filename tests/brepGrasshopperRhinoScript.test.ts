import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  BREP_GRASSHOPPER_RHINO_PYTHON3_COMPONENT_GUID,
  BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID,
  createBrepGrasshopperRhinoScriptPlan,
} from '../shared/brepGrasshopperRhinoScript.ts';
import { createBrepGrasshopperPackagePlan } from '../shared/brepGrasshopperPackagePlan.ts';

const fixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

type MutableFixture = Record<string, unknown> & {
  model: Record<string, unknown> & {
    sourceRevisionId: string;
  };
  source: Record<string, unknown> & {
    nodes: Array<Record<string, unknown>>;
    resultNodeId: string;
    projectObject: Record<string, unknown> & {
      footprintNodeId?: string;
      clearanceEnvelopeNodeId?: string;
    };
  };
};

function cloneFixture(): MutableFixture {
  return JSON.parse(JSON.stringify(fixture)) as MutableFixture;
}

describe('BRep Phase 8E-B Rhino Python 3 script plan', () => {
  it('maps the existing package identity to a self-contained canonical-placement box script', async () => {
    const script = await createBrepGrasshopperRhinoScriptPlan(fixture);
    const packagePlan = await createBrepGrasshopperPackagePlan(fixture);

    assert.equal(script.kind, 'brepia-rhino-python3-script-plan');
    assert.equal(script.schemaVersion, 1);
    assert.equal(script.componentInstanceGuid, packagePlan.component.instanceGuid);
    assert.equal(script.projectId, 'cabinetA42');
    assert.equal(script.sourceRevisionId, 'revision-42');
    assert.match(script.sourceSha256, /^[0-9a-f]{64}$/);

    assert.deepEqual(
      script.inputs.map((input) => [
        input.inputId,
        input.variableName,
        input.nickname,
        input.sourceObjectGuid,
        input.converterType,
      ]),
      [
        ['height', 'Height', 'Height', packagePlan.controls[0]?.instanceGuid, 'System.Double'],
        ['width', 'Width', 'Width', packagePlan.controls[1]?.instanceGuid, 'System.Double'],
      ],
    );
    assert.deepEqual(
      script.outputs.map((output) => [output.outputId, output.variableName, output.nickname]),
      [
        ['result', 'Result', 'Result'],
        ['footprint', 'Footprint', 'Footprint'],
        ['clearanceEnvelope', 'Clearance', 'Clearance'],
        ['maintenanceEnvelope', 'Maintenance', 'Maintenance'],
        ['connectionPoints', 'Connections', 'Connections'],
        ['mountingPoints', 'Mounting', 'Mounting'],
        ['cablePoints', 'Cable', 'Cable'],
        ['metadata', 'Metadata', 'Metadata'],
      ],
    );

    assert.match(script.source, /import Rhino\.Geometry as rg/);
    assert.match(script.source, /brepiaNode0Width = float\(brepia_scalar\(Width\)\)/);
    assert.match(script.source, /brepiaNode0Height = float\(brepia_scalar\(Height\)\)/);
    assert.match(script.source, /brepiaNode0 = rg\.Box\(/);
    assert.match(
      script.source,
      /rg\.Interval\(-brepiaNode0Width \/ 2\.0, brepiaNode0Width \/ 2\.0\)/,
    );
    assert.match(
      script.source,
      /rg\.Interval\(-brepiaNode0Depth \/ 2\.0, brepiaNode0Depth \/ 2\.0\)/,
    );
    assert.match(
      script.source,
      /rg\.Interval\(-brepiaNode0Height \/ 2\.0, brepiaNode0Height \/ 2\.0\)/,
    );
    assert.match(
      script.source,
      /rg\.Transform\.PlaneToPlane\(rg\.Plane\.WorldXY, brepiaDefaultPlane\)/,
    );
    assert.doesNotMatch(script.source, /isinstance\(Plane|brepia_normalize_plane\(Plane\)/);
    assert.match(
      script.source,
      /Result = brepia_place_brep\(brepiaNode0, brepiaTransform\)/,
    );
    assert.match(
      script.source,
      /Footprint = brepia_place_brep\(brepiaNode0, brepiaTransform\)/,
    );
    assert.match(
      script.source,
      /Cable = \[brepia_transform_point\(rg\.Point3d\(0, 100, 0\), brepiaTransform\)\]/,
    );
    assert.doesNotMatch(script.source, /brepiaP0|brepiaP1|brepiaPlacement/);
    assert.match(script.source, /sourceRevisionId/);
    assert.doesNotMatch(script.source, /BREPIA_GRASSHOPPER_TOKEN/);
    assert.doesNotMatch(script.source, /HttpClient/);
  });

  it('uses McNeel Rhino 8 built-in Python 3 identities rather than a Brepia GHA identity', () => {
    assert.equal(
      BREP_GRASSHOPPER_RHINO_PYTHON3_COMPONENT_GUID,
      '719467e6-7cf5-4848-99b0-c5dd57e5442c',
    );
    assert.equal(
      BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID,
      '066d0a87-236f-4eae-a0f4-9e42f5327962',
    );
  });

  it('keeps Grasshopper object and port identity stable across Brepia revisions while script provenance changes', async () => {
    const original = await createBrepGrasshopperRhinoScriptPlan(fixture);
    const nextRevision = cloneFixture();
    nextRevision.model.sourceRevisionId = 'revision-43';
    const revised = await createBrepGrasshopperRhinoScriptPlan(nextRevision);

    assert.equal(revised.componentInstanceGuid, original.componentInstanceGuid);
    assert.deepEqual(
      revised.inputs.map((input) => input.instanceGuid),
      original.inputs.map((input) => input.instanceGuid),
    );
    assert.deepEqual(
      revised.outputs.map((output) => output.instanceGuid),
      original.outputs.map((output) => output.instanceGuid),
    );
    assert.notEqual(revised.sourceSha256, original.sourceSha256);
    assert.match(revised.source, /sourceRevisionId: revision-43/);
  });

  it('emits the first canonical through-hole graph as centered box, centered cylinder, transform and subtract', async () => {
    const withHole = cloneFixture();
    const body = withHole.source.nodes[0];
    assert.ok(body);
    withHole.source.nodes = [
      body,
      { id: 'hole', type: 'cylinder', radius: 40, height: 520 },
      {
        id: 'positionedHole',
        type: 'transform',
        input: 'hole',
        translate: [600, 250, -10],
      },
      {
        id: 'bodyWithHole',
        type: 'subtract',
        base: 'body',
        tools: ['positionedHole'],
      },
    ];
    withHole.source.resultNodeId = 'bodyWithHole';

    const script = await createBrepGrasshopperRhinoScriptPlan(withHole);

    assert.match(
      script.source,
      /brepiaNode\d+Cylinder = rg\.Cylinder\(rg\.Circle\(rg\.Plane\.WorldXY, brepiaNode\d+Radius\), brepiaNode\d+Height\)/,
    );
    assert.match(
      script.source,
      /\.Transform\(rg\.Transform\.Translation\(rg\.Vector3d\(0, 0, -brepiaNode\d+Height \/ 2\.0\)\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode2Translation = rg\.Transform\.Translation\(rg\.Vector3d\(600, 250, -10\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode2Transform = brepiaNode2Translation \* brepiaNode2Rotation/,
    );
    assert.match(script.source, /brepiaNode2\.Transform\(brepiaNode2Transform\)/);
    assert.match(
      script.source,
      /rg\.Brep\.CreateBooleanDifference\(brepiaNode\d+, brepiaNode\d+, brepiaTolerance\)/,
    );
    assert.match(
      script.source,
      /Result = brepia_place_brep\(brepiaNode\d+, brepiaTransform\)/,
    );
    assert.match(
      script.source,
      /Footprint = brepia_place_brep\(brepiaNode0, brepiaTransform\)/,
    );
  });

  it('supports exact auxiliary role nodes instead of forcing them to reuse the result', async () => {
    const withClearance = cloneFixture();
    withClearance.source.nodes.push({
      id: 'clearance',
      type: 'box',
      width: 1300,
      depth: 600,
      height: 2200,
    });
    withClearance.source.projectObject.clearanceEnvelopeNodeId = 'clearance';

    const script = await createBrepGrasshopperRhinoScriptPlan(withClearance);
    assert.match(
      script.source,
      /Clearance = brepia_place_brep\(brepiaNode1, brepiaTransform\)/,
    );
  });

  it('emits M6 intrinsic XYZ rotation before translation for canonical transform nodes', async () => {
    const rotated = cloneFixture();
    rotated.source.nodes.push({
      id: 'rotatedBody',
      type: 'transform',
      input: 'body',
      translate: [7, 11, 13],
      rotateDeg: [30, 20, 10],
    });
    rotated.source.resultNodeId = 'rotatedBody';

    const script = await createBrepGrasshopperRhinoScriptPlan(rotated);

    assert.match(script.source, /brepiaNode1RotationXDeg = float\(30\)/);
    assert.match(script.source, /brepiaNode1RotationYDeg = float\(20\)/);
    assert.match(script.source, /brepiaNode1RotationZDeg = float\(10\)/);
    assert.match(
      script.source,
      /brepiaNode1RotationX = rg\.Transform\.Rotation\(math\.radians\(brepiaNode1RotationXDeg\), rg\.Vector3d\(1, 0, 0\), rg\.Point3d\(0, 0, 0\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1RotationY = rg\.Transform\.Rotation\(math\.radians\(brepiaNode1RotationYDeg\), rg\.Vector3d\(0, 1, 0\), rg\.Point3d\(0, 0, 0\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1RotationZ = rg\.Transform\.Rotation\(math\.radians\(brepiaNode1RotationZDeg\), rg\.Vector3d\(0, 0, 1\), rg\.Point3d\(0, 0, 0\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1Rotation = brepiaNode1RotationX \* brepiaNode1RotationY \* brepiaNode1RotationZ/,
    );
    assert.match(
      script.source,
      /brepiaNode1Translation = rg\.Transform\.Translation\(rg\.Vector3d\(7, 11, 13\)\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1Transform = brepiaNode1Translation \* brepiaNode1Rotation/,
    );
    assert.match(script.source, /brepiaNode1\.Transform\(brepiaNode1Transform\)/);
  });

  it('emits canonical parallel-axis fillets using normalized edge-midpoint tangents', async () => {
    const withFillet = cloneFixture();
    withFillet.source.nodes.push({
      id: 'filletedBody',
      type: 'fillet',
      input: 'body',
      radius: 5,
      selector: { kind: 'parallelToAxis', axis: 'z' },
    });
    withFillet.source.resultNodeId = 'filletedBody';

    const script = await createBrepGrasshopperRhinoScriptPlan(withFillet);

    assert.match(script.source, /from System import Array, Double, Int32/);
    assert.match(script.source, /brepiaNode1Input = brepiaNode0\.DuplicateBrep\(\)/);
    assert.match(script.source, /brepiaNode1Radius = float\(5\)/);
    assert.match(script.source, /brepiaNode1Axis = rg\.Vector3d\(0, 0, 1\)/);
    assert.match(
      script.source,
      /brepiaNode1EdgeParameter = brepiaNode1Edge\.Domain\.ParameterAt\(0\.5\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1EdgeDirection = brepiaNode1Edge\.TangentAt\(brepiaNode1EdgeParameter\)/,
    );
    assert.match(script.source, /if not brepiaNode1EdgeDirection\.Unitize\(\):/);
    assert.match(
      script.source,
      /if abs\(abs\(brepiaNode1EdgeDot\) - 1\.0\) <= 1e-3:/,
    );
    assert.match(
      script.source,
      /brepiaNode1EdgeArray = Array\[Int32\]\(brepiaNode1EdgeIndices\)/,
    );
    assert.match(
      script.source,
      /brepiaNode1Radii = Array\[Double\]\(\[brepiaNode1Radius\] \* len\(brepiaNode1EdgeIndices\)\)/,
    );
    assert.match(script.source, /brepiaNode1Parts = rg\.Brep\.CreateFilletEdges\(/);
    assert.match(script.source, /rg\.BlendType\.Fillet/);
    assert.match(script.source, /rg\.RailType\.RollingBall/);
    assert.match(script.source, /brepiaTolerance/);
    assert.match(
      script.source,
      /Brepia fillet selector for node filletedBody matched no edges/,
    );
    assert.match(
      script.source,
      /Result = brepia_place_brep\(brepiaNode1, brepiaTransform\)/,
    );
  });

  it('keeps parameter-backed canonical fillet radii dynamic', async () => {
    const withFillet = cloneFixture();
    withFillet.source.nodes.push({
      id: 'filletedBody',
      type: 'fillet',
      input: 'body',
      radius: { parameter: 'width' },
      selector: { kind: 'parallelToAxis', axis: 'z' },
    });
    withFillet.source.resultNodeId = 'filletedBody';

    const script = await createBrepGrasshopperRhinoScriptPlan(withFillet);

    assert.match(script.source, /brepiaNode1Radius = float\(brepia_scalar\(Width\)\)/);
    assert.match(script.source, /brepiaNode1Axis = rg\.Vector3d\(0, 0, 1\)/);
    assert.match(script.source, /brepiaNode1Parts = rg\.Brep\.CreateFilletEdges\(/);
  });
});
