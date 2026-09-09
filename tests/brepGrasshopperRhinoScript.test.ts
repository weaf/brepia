import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  BREP_GRASSHOPPER_RHINO_PYTHON3_COMPONENT_GUID,
  BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID,
  BrepGrasshopperRhinoScriptError,
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
    assert.match(script.source, /brepiaNode0Width = float\(Width\)/);
    assert.match(script.source, /brepiaNode0Height = float\(Height\)/);
    assert.match(script.source, /brepiaNode0 = rg\.Box\(/);
    assert.match(script.source, /rg\.Interval\(0\.0, brepiaNode0Width\)/);
    assert.match(script.source, /rg\.Interval\(0\.0, brepiaNode0Depth\)/);
    assert.match(script.source, /rg\.Interval\(0\.0, brepiaNode0Height\)/);
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

  it('emits the first canonical through-hole graph as box, cylinder, translate and subtract', async () => {
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
      /\.Transform\(rg\.Transform\.Translation\(rg\.Vector3d\(600, 250, -10\)\)\)/,
    );
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

  it('fails closed for transform rotations that have not yet been host-parity accepted', async () => {
    const unsupported = cloneFixture();
    unsupported.source.nodes.push({
      id: 'rotatedBody',
      type: 'transform',
      input: 'body',
      rotateDeg: [0, 0, 90],
    });
    unsupported.source.resultNodeId = 'rotatedBody';

    await assert.rejects(
      () => createBrepGrasshopperRhinoScriptPlan(unsupported),
      (error: unknown) =>
        error instanceof BrepGrasshopperRhinoScriptError &&
        error.code === 'unsupported_model' &&
        /rotation/.test(error.message),
    );
  });

  it('fails closed for fillets until Rhino edge-selection parity is separately proven', async () => {
    const unsupported = cloneFixture();
    unsupported.source.nodes.push({
      id: 'filletedBody',
      type: 'fillet',
      input: 'body',
      radius: 5,
      selector: { kind: 'parallelToAxis', axis: 'z' },
    });
    unsupported.source.resultNodeId = 'filletedBody';

    await assert.rejects(
      () => createBrepGrasshopperRhinoScriptPlan(unsupported),
      (error: unknown) =>
        error instanceof BrepGrasshopperRhinoScriptError &&
        error.code === 'unsupported_model' &&
        /fillet/.test(error.message),
    );
  });
});
