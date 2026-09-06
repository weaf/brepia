import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { brepGrasshopperExactArtifactFileName } from '@shared/brepGrasshopperRuntime';

const project = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Brepia.Grasshopper.csproj', import.meta.url),
  'utf8',
);
const contract = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaGrasshopperContract.cs', import.meta.url),
  'utf8',
);
const client = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaEvaluatorClient.cs', import.meta.url),
  'utf8',
);
const importer = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaExactArtifactImporter.cs', import.meta.url),
  'utf8',
);
const solver = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaSolveRuntime.cs', import.meta.url),
  'utf8',
);
const component = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Components/BrepiaProjectComponent.cs', import.meta.url),
  'utf8',
);

describe('BRep Phase 7B Rhino/Grasshopper plugin boundary', () => {
  it('pins a matching stable Rhino 8 SDK pair without shipping Rhino runtime assets', () => {
    assert.match(project, /<TargetFramework>net8\.0<\/TargetFramework>/);
    assert.match(project, /RhinoCommon" Version="8\.34\.26223\.11001" ExcludeAssets="runtime"/);
    assert.match(project, /Grasshopper" Version="8\.34\.26223\.11001" ExcludeAssets="runtime"/);
    assert.match(project, /<TargetExt>\.gha<\/TargetExt>/);
  });

  it('rebuilds trusted runtime identity from canonical contract source', () => {
    assert.match(contract, /brepia-grasshopper-contract/);
    assert.match(contract, /ContractSchemaVersion = 1/);
    assert.match(contract, /MaxContractBytes = 2_097_152/);
    assert.match(contract, /model identity does not match its canonical BRep source/);
    assert.match(contract, /BuildNormalizedRoot/);
    assert.match(contract, /source\.DeepClone\(\)/);
  });

  it('keeps exact role filenames aligned with the shared Phase 7A manifest', () => {
    for (const role of [
      'result',
      'footprint',
      'clearanceEnvelope',
      'maintenanceEnvelope',
    ] as const) {
      assert.match(
        contract,
        new RegExp(brepGrasshopperExactArtifactFileName(role).replace('.', '\\.')),
      );
    }
  });

  it('calls the accepted authenticated Brepia 3DM evaluator boundary with bounded data', () => {
    assert.match(client, /api\/brep\/export\/step/);
    assert.match(client, /model\/vnd\.3dm/);
    assert.match(client, /AuthenticationHeaderValue\("Bearer"/);
    assert.match(client, /MaxThreeDmBytes = 64 \* 1024 \* 1024/);
    assert.match(client, /Unknown Brepia parameter id/);
    assert.match(solver, /EvaluateThreeDmAsync/);
    assert.match(solver, /BrepiaExactArtifactImporter\.Import/);
  });

  it('fails closed through 3DM identity and exact STEP import instead of mesh promotion', () => {
    assert.match(importer, /File3dm\.Read/);
    assert.match(importer, /brepia\.projectId/);
    assert.match(importer, /brepia\.schemaVersion/);
    assert.match(importer, /brepia\.resultNodeId/);
    assert.match(importer, /brepia\.exactBrepArtifacts/);
    assert.match(importer, /model\.EmbeddedFiles/);
    assert.match(importer, /SaveToFile/);
    assert.match(importer, /ISO-10303-21/);
    assert.match(importer, /RhinoDoc\.CreateHeadless/);
    assert.match(importer, /FileStp\.Read/);
    assert.doesNotMatch(importer, /CreateFromMesh/);
  });

  it('persists the normalized embedded contract without making a file path canonical', () => {
    assert.match(component, /ContractArchiveKey = "brepia\.contract\.v1"/);
    assert.match(component, /writer\.SetString\(ContractArchiveKey, _contract\.NormalizedJson\)/);
    assert.match(component, /reader\.GetString\(ContractArchiveKey\)/);
    assert.doesNotMatch(component, /Contract JSON/);
    assert.doesNotMatch(component, /File Path/);
  });

  it('reserves the fixed v1 output order while leaving dynamic inputs to Phase 7C', () => {
    const outputNames = [
      'Result',
      'Footprint',
      'Clearance',
      'Maintenance',
      'Connections',
      'Mounting',
      'Cable',
      'Metadata',
    ];
    let previous = -1;
    for (const name of outputNames) {
      const position = component.indexOf(`"${name}"`);
      assert.ok(position > previous, `${name} output must keep v1 order`);
      previous = position;
    }
    assert.match(component, /Phase 7C reconstructs one numeric input/);
  });
});
