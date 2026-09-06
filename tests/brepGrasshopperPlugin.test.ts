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
const environment = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaEvaluatorEnvironment.cs', import.meta.url),
  'utf8',
);
const importer = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaExactArtifactImporter.cs', import.meta.url),
  'utf8',
);
const outputs = fs.readFileSync(
  new URL('../grasshopper/Brepia.Grasshopper/Runtime/BrepiaProjectOutputs.cs', import.meta.url),
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
const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);

describe('BRep Phase 7 Rhino/Grasshopper smart-component boundary', () => {
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
    assert.match(environment, /BREPIA_GRASSHOPPER_BASE_URL/);
    assert.match(environment, /BREPIA_GRASSHOPPER_TOKEN/);
    assert.match(environment, /never persisted in the Grasshopper document/);
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

  it('persists canonical contract and stable input IDs without persisting evaluator secrets or file paths', () => {
    assert.match(component, /ContractArchiveKey = "brepia\.contract\.v1"/);
    assert.match(component, /InputIdsArchiveKey = "brepia\.inputParameterIds\.v1"/);
    assert.match(component, /writer\.SetString\(ContractArchiveKey, _contract\.NormalizedJson\)/);
    assert.match(component, /JsonSerializer\.Serialize\(_inputParameterIds\)/);
    assert.match(component, /reader\.GetString\(ContractArchiveKey\)/);
    assert.doesNotMatch(component, /writer\.SetString\([^\n]*TOKEN/i);
    assert.doesNotMatch(component, /writer\.SetString\([^\n]*FileName/i);
  });

  it('reconstructs dynamic numeric inputs plus optional Plane from stable Brepia IDs', () => {
    assert.match(component, /new Param_Number\(\)/);
    assert.match(component, /new Param_Plane\(\)/);
    assert.match(component, /parameter\.SetPersistentData\(new GH_Number\(definition\.Default\)\)/);
    assert.match(component, /Brepia parameter id: \{definition\.Id\}/);
    assert.match(component, /PlacementInputId/);
    assert.match(component, /parameter\.Optional = true/);
    assert.match(component, /UnregisterInputParameter\(parameter, isolate: !preserveSources\)/);
  });

  it('loads or replaces a portable contract explicitly instead of making its path canonical', () => {
    assert.match(component, /CreateAttributes\(\)/);
    assert.match(component, /BrepiaProjectComponentAttributes/);
    assert.match(component, /RespondToMouseDoubleClick/);
    assert.match(component, /LoadContractFromDialog\(\)/);
    assert.match(component, /Load Brepia Grasshopper contract/);
    assert.match(component, /Replace Brepia Grasshopper contract/);
    assert.match(component, /Rhino\.UI\.OpenFileDialog/);
    assert.match(component, /\.brepia-grasshopper\.json/);
    assert.match(component, /LoadContractJson\(File\.ReadAllText\(dialog\.FileName\)\)/);
    assert.doesNotMatch(component, /System\.Windows\.Forms/);
  });

  it('applies rigid WorldXY-to-target Plane placement to exact Breps and semantic data', () => {
    assert.match(outputs, /Transform\.PlaneToPlane\(Plane\.WorldXY, targetPlane\)/);
    assert.match(outputs, /NormalizePlane/);
    assert.match(outputs, /xAxis\.Unitize\(\)/);
    assert.match(outputs, /yAxis -= Vector3d\.Multiply\(yAxis, xAxis\) \* xAxis/);
    assert.match(outputs, /brep\.Transform\(transform\)/);
    assert.match(outputs, /position\.Transform\(transform\)/);
    assert.match(outputs, /sourceDirection\.Transform\(transform\)/);
    assert.match(outputs, /sourceRevisionId/);
    assert.match(outputs, /semanticPoints/);
  });

  it('carries evaluator warnings through the 3DM handoff into Grasshopper runtime messages', () => {
    assert.match(driver, /"brepia\.warnings": compact_json\(result\["warnings"\]\)/);
    assert.match(importer, /ParseWarnings/);
    assert.match(component, /GH_RuntimeMessageLevel\.Warning/);
    assert.match(component, /GH_RuntimeMessageLevel\.Error/);
  });

  it('keeps the fixed v1 output order and populates all standard outputs', () => {
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
    for (let index = 0; index <= 7; index += 1) {
      assert.match(component, new RegExp(`DA\\.SetData(?:List)?\\(\\s*${index}`));
    }
  });
});
