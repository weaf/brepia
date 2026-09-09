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
  it('maps the existing package identity to a self-contained RhinoCommon box script', async () => {
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
        input.sourceObjectGuid,
        input.converterType,
      ]),
      [
        ['height', 'brepiaP0', packagePlan.controls[0]?.instanceGuid, 'System.Double'],
        ['width', 'brepiaP1', packagePlan.controls[1]?.instanceGuid, 'System.Double'],
        ['placement', 'brepiaPlacement', null, 'System.Object'],
      ],
    );
    assert.deepEqual(
      script.outputs.map((output) => output.outputId),
      [
        'result',
        'footprint',
        'clearanceEnvelope',
        'maintenanceEnvelope',
        'connectionPoints',
        'mountingPoints',
        'cablePoints',
        'metadata',
      ],
    );

    assert.match(script.source, /import Rhino\.Geometry as rg/);
    assert.match(script.source, /brepiaLocal = rg\.Box\(/);
    assert.match(
      script.source,
      /rg\.Interval\(-brepiaWidth \/ 2\.0, brepiaWidth \/ 2\.0\)/,
    );
    assert.match(
      script.source,
      /rg\.Interval\(-brepiaDepth \/ 2\.0, brepiaDepth \/ 2\.0\)/,
    );
    assert.match(script.source, /rg\.Interval\(0\.0, brepiaHeight\)/);
    assert.match(
      script.source,
      /rg\.Transform\.PlaneToPlane\(rg\.Plane\.WorldXY, brepiaTargetPlane\)/,
    );
    assert.match(script.source, /isinstance\(brepiaPlacement, rg\.Plane\)/);
    assert.match(script.source, /footprint = brepiaResult\.DuplicateBrep\(\)/);
    assert.match(
      script.source,
      /cablePoints = \[brepia_transform_point\(rg\.Point3d\(0, 100, 0\), brepiaTransform\)\]/,
    );
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

  it('fails closed for canonical node graphs that are not yet proven equivalent in RhinoCommon', async () => {
    const unsupported = cloneFixture();
    unsupported.source.nodes.push({
      id: 'movedBody',
      type: 'transform',
      input: 'body',
      translate: [10, 0, 0],
    });
    unsupported.source.resultNodeId = 'movedBody';
    unsupported.source.projectObject.footprintNodeId = 'movedBody';

    await assert.rejects(
      () => createBrepGrasshopperRhinoScriptPlan(unsupported),
      (error: unknown) =>
        error instanceof BrepGrasshopperRhinoScriptError &&
        error.code === 'unsupported_model',
    );
  });

  it('fails closed when an auxiliary exact role cannot be represented by the single-box subset', async () => {
    const unsupported = cloneFixture();
    unsupported.source.nodes.push({
      id: 'clearance',
      type: 'box',
      width: 1300,
      depth: 600,
      height: 2200,
    });
    unsupported.source.projectObject.clearanceEnvelopeNodeId = 'clearance';

    await assert.rejects(
      () => createBrepGrasshopperRhinoScriptPlan(unsupported),
      (error: unknown) =>
        error instanceof BrepGrasshopperRhinoScriptError &&
        error.code === 'unsupported_model',
    );
  });
});
