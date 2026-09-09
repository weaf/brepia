import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import { compileBrepGrasshopperExecutableGhx } from '../shared/brepGrasshopperExecutableGhx.ts';
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

function decodeBase64Utf8(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8');
}

describe('BRep Phase 8E executable GHX', () => {
  it('emits the Rhino-host-compatible archive envelope proven in installed Grasshopper', async () => {
    const ghx = await compileBrepGrasshopperExecutableGhx(fixture);

    assert.match(ghx, /<Archive name="Root">/);
    assert.match(ghx, /<chunks count="2"><chunk name="Definition">/);
    assert.match(ghx, /<chunk name="DocumentHeader"><items count="5">/);
    assert.match(ghx, /<item name="PreviewNormal" type_name="gh_drawing_color" type_code="36">/);
    assert.match(ghx, /<item name="PreviewSelected" type_name="gh_drawing_color" type_code="36">/);
    assert.match(ghx, /<chunk name="DefinitionProperties"><items count="4">/);
    assert.match(ghx, /<item name="KeepOpen" type_name="gh_bool" type_code="1">false<\/item>/);
    assert.match(ghx, /<chunk name="GHALibraries">/);
    assert.match(ghx, new RegExp(BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID));
    assert.match(ghx, /<chunk name="Thumbnail">/);
  });

  it('embeds one modern Rhino Python 3 Script after the native Brepia parameter controls', async () => {
    const [ghx, packagePlan, script] = await Promise.all([
      compileBrepGrasshopperExecutableGhx(fixture),
      createBrepGrasshopperPackagePlan(fixture),
      createBrepGrasshopperRhinoScriptPlan(fixture),
    ]);

    assert.match(
      ghx,
      new RegExp(
        `<item name="ObjectCount" type_name="gh_int32" type_code="3">${
          packagePlan.controls.length + 1
        }</item>`,
      ),
    );
    assert.match(ghx, new RegExp(BREP_GRASSHOPPER_RHINO_PYTHON3_COMPONENT_GUID));
    assert.match(
      ghx,
      new RegExp(
        `<item name="InstanceGuid" type_name="gh_guid" type_code="9">${script.componentInstanceGuid}</item>`,
      ),
    );
    assert.match(
      ghx,
      /<item name="ScriptComponentVersion" type_name="gh_int32" type_code="3">3<\/item>/,
    );
    assert.match(
      ghx,
      /<item name="Taxon" type_name="gh_string" type_code="10">\*\.\*\.python<\/item>/,
    );
    assert.match(
      ghx,
      /<item name="Version" type_name="gh_string" type_code="10">3\.\*<\/item>/,
    );
    assert.match(
      ghx,
      /<item name="Name" type_name="gh_string" type_code="10">Python 3 Script<\/item>/,
    );
    assert.doesNotMatch(ghx, /Brepia\.Grasshopper\.gha/i);
  });

  it('stores the exact deterministic Brepia RhinoCommon Python source as UTF-8 base64', async () => {
    const [ghx, script] = await Promise.all([
      compileBrepGrasshopperExecutableGhx(fixture),
      createBrepGrasshopperRhinoScriptPlan(fixture),
    ]);
    const match = /<chunk name="Script"><items count="5">[\s\S]*?<item name="Text" type_name="gh_string" type_code="10">([^<]+)<\/item>/.exec(
      ghx,
    );
    assert.ok(match?.[1]);
    assert.equal(decodeBase64Utf8(match[1]), script.source);
    assert.match(script.source, /import Rhino\.Geometry as rg/);
    assert.match(script.source, /brepiaLocal = rg\.Box\(/);
    assert.match(script.source, /result = brepiaResult/);
    assert.doesNotMatch(script.source, /Script_Instance|GH_ScriptInstance/);
  });

  it('wires every numeric input to its stable native control and leaves placement unconnected', async () => {
    const [ghx, script] = await Promise.all([
      compileBrepGrasshopperExecutableGhx(fixture),
      createBrepGrasshopperRhinoScriptPlan(fixture),
    ]);

    for (const input of script.inputs.filter((entry) => entry.kind === 'number')) {
      assert.ok(input.sourceObjectGuid);
      assert.match(
        ghx,
        new RegExp(
          `<item name="Source" index="0" type_name="gh_guid" type_code="9">${input.sourceObjectGuid}</item>`,
        ),
      );
      assert.match(
        ghx,
        new RegExp(
          `<item name="InstanceGuid" type_name="gh_guid" type_code="9">${input.instanceGuid}</item>`,
        ),
      );
    }

    const placement = script.inputs.find((entry) => entry.kind === 'placement');
    assert.ok(placement);
    assert.equal(placement.sourceObjectGuid, null);
    const placementStart = ghx.indexOf(
      `<item name="InstanceGuid" type_name="gh_guid" type_code="9">${placement.instanceGuid}</item>`,
    );
    assert.ok(placementStart >= 0);
    const placementEnd = ghx.indexOf('</chunk>', placementStart);
    const placementXml = ghx.slice(placementStart, placementEnd);
    assert.match(
      placementXml,
      /<item name="SourceCount" type_name="gh_int32" type_code="3">0<\/item>/,
    );
    assert.doesNotMatch(placementXml, /<item name="Source"/);
  });

  it('serializes all eight stable Brepia output ports as generic Rhino script outputs', async () => {
    const [ghx, script] = await Promise.all([
      compileBrepGrasshopperExecutableGhx(fixture),
      createBrepGrasshopperRhinoScriptPlan(fixture),
    ]);

    assert.equal(script.outputs.length, 8);
    for (const output of script.outputs) {
      assert.match(
        ghx,
        new RegExp(
          `<item name="InstanceGuid" type_name="gh_guid" type_code="9">${output.instanceGuid}</item>`,
        ),
      );
      assert.match(ghx, new RegExp(`>${output.variableName}<`));
    }
    assert.match(
      ghx,
      /<item name="OutputCount" type_name="gh_int32" type_code="3">8<\/item>/,
    );
  });

  it('remains byte-for-byte deterministic for the same canonical input', async () => {
    const first = await compileBrepGrasshopperExecutableGhx(fixture);
    const second = await compileBrepGrasshopperExecutableGhx(fixture);
    assert.equal(first, second);
  });
});
