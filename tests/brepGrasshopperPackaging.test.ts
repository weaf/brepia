import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const packagePlan = fs.readFileSync(
  new URL(
    '../grasshopper/Brepia.Grasshopper/Packaging/BrepiaGrasshopperPackagePlan.cs',
    import.meta.url,
  ),
  'utf8',
);
const packager = fs.readFileSync(
  new URL(
    '../grasshopper/Brepia.Grasshopper/Packaging/BrepiaGrasshopperDocumentPackager.cs',
    import.meta.url,
  ),
  'utf8',
);
const cliProject = fs.readFileSync(
  new URL(
    '../grasshopper/Brepia.Grasshopper.Packager/Brepia.Grasshopper.Packager.csproj',
    import.meta.url,
  ),
  'utf8',
);
const cli = fs.readFileSync(
  new URL(
    '../grasshopper/Brepia.Grasshopper.Packager/Program.cs',
    import.meta.url,
  ),
  'utf8',
);
const workflow = fs.readFileSync(
  new URL('../.github/workflows/grasshopper-build.yml', import.meta.url),
  'utf8',
);

describe('BRep Phase 8B/8C Grasshopper packaging boundary', () => {
  it('mirrors the accepted portable package-plan identity and layout semantics in the Rhino emitter', () => {
    assert.match(packagePlan, /InstanceGuidNamespace = "brepia-grasshopper-package-plan-v1"/);
    assert.match(packagePlan, /StableGuid\(contract\.ProjectId, "brepia-project"\)/);
    assert.match(
      packagePlan,
      /StableGuid\(contract\.ProjectId, "number-control", parameter\.Id\)/,
    );
    assert.match(packagePlan, /ControlX = 40/);
    assert.match(packagePlan, /ControlY = 80/);
    assert.match(packagePlan, /ControlYStep = 70/);
    assert.match(packagePlan, /ComponentX = 420/);
    assert.match(packagePlan, /parameter\.Min is not null && parameter\.Max is not null/);
    assert.match(packagePlan, /PlacementInputId => BrepiaGrasshopperContract\.PlacementInputId/);
    assert.doesNotMatch(packagePlan, /SourceRevisionId.*StableGuid/);
  });

  it('rebuilds transported package-plan derived state from the embedded canonical contract', () => {
    assert.match(packagePlan, /Kind = "brepia-grasshopper-package-plan"/);
    assert.match(packagePlan, /SchemaVersion = 1/);
    assert.match(packagePlan, /MaxBytes = 4 \* 1024 \* 1024/);
    assert.match(packagePlan, /JsonDocument\.Parse\(json\)/);
    assert.match(packagePlan, /root\.TryGetProperty\("contract"/);
    assert.match(packagePlan, /BrepiaGrasshopperContract\.Parse\(contractElement\.GetRawText\(\)\)/);
    assert.match(packagePlan, /return Create\(contract\)/);
    assert.match(
      packagePlan,
      /transported component\/control\/wire sections are derived data/,
    );
  });

  it('emits one embedded Brepia component plus real native GH numeric controls without solving geometry', () => {
    assert.match(packager, /BrepiaGrasshopperPackagePlan\.Create\(contract\)/);
    assert.match(packager, /new BrepiaProjectComponent\(\)/);
    assert.match(packager, /LoadContractJson\(plan\.Contract\.NormalizedJson\)/);
    assert.match(packager, /new GH_NumberSlider\(\)/);
    assert.match(packager, /new Param_Number/);
    assert.match(packager, /SetPersistentData\(new GH_Number\(plan\.Default\)\)/);
    assert.match(packager, /document\.AddObject\(control\.DocumentObject, update: false\)/);
    assert.match(packager, /document\.AddObject\(component, update: false\)/);
    assert.doesNotMatch(packager, /BrepiaSolveRuntime/);
    assert.doesNotMatch(packager, /EvaluateThreeDmAsync/);
    assert.doesNotMatch(packager, /NewSolution\(/);
  });

  it('applies canonical slider values, bounds and bounded step snapping without inventing coarser semantics', () => {
    assert.match(packager, /slider\.Slider\.Minimum = ToDecimal\(plan\.Min\.Value/);
    assert.match(packager, /slider\.Slider\.Maximum = ToDecimal\(plan\.Max\.Value/);
    assert.match(packager, /slider\.Slider\.Value = ToDecimal\(plan\.Default/);
    assert.match(packager, /slider\.Slider\.DecimalPlaces = RequiredDecimalPlaces\(plan\)/);
    assert.match(packager, /SetSnapRanges/);
    assert.match(packager, /new SliderSnapRange\(value\)/);
    assert.match(packager, /MaxGeneratedSnapPoints = 4_096/);
    assert.match(
      packager,
      /rather than fabricating a coarser Grasshopper step/,
    );
    assert.match(packager, /Attributes\.Bounds = new RectangleF/);
  });

  it('wires controls by stable Brepia input id rather than mutable labels', () => {
    assert.match(packager, /WireControls\(plan, component, generatedControls\)/);
    assert.match(packager, /ResolveComponentInputById/);
    assert.match(
      packager,
      /string\.Equals\(contract\.Parameters\[index\]\.Id, inputId, StringComparison\.Ordinal\)/,
    );
    assert.match(packager, /target\.AddSource\(source\.OutputParameter\)/);
    assert.doesNotMatch(packager, /Params\.Input.*NickName/);
    assert.doesNotMatch(packager, /Params\.Input.*\.Name/);
  });

  it('keeps generated GH object identity stable across revisions while retaining source-revision provenance', () => {
    assert.match(packager, /component\.NewInstanceGuid\(plan\.Component\.InstanceGuid\)/);
    assert.match(packager, /slider\.NewInstanceGuid\(plan\.InstanceGuid\)/);
    assert.match(packager, /parameter\.NewInstanceGuid\(plan\.InstanceGuid\)/);
    assert.match(packager, /plan\.Contract\.SourceRevisionId/);
  });

  it('leaves the Brepia placement Plane unconnected and fails closed if that invariant changes', () => {
    assert.match(packager, /EnsurePlacementUnconnected\(plan, component\)/);
    assert.match(packager, /component\.Params\.Input\[\^1\]\.SourceCount != 0/);
    assert.doesNotMatch(packagePlan, /number-control.*placement/);
  });

  it('serializes with official Grasshopper document/archive APIs and validates generated identities on read-back', () => {
    assert.match(packager, /new GH_Document\(\)/);
    assert.match(packager, /archive\.AppendObject\(document, DefinitionArchiveName\)/);
    assert.match(packager, /archive\.Serialize_Binary\(\)/);
    assert.match(packager, /File\.WriteAllBytes\(fullOutputPath, binary\)/);
    assert.match(packager, /archive\.Deserialize_Binary\(binary\)/);
    assert.match(packager, /archive\.Serialize_Xml\(\)/);
    assert.match(packager, /brepia\.contract\.v1/);
    assert.match(packager, /plan\.Controls\.Any/);
    assert.doesNotMatch(packager, /archive\.WriteToFile/);
  });

  it('accepts the versioned server package-plan transport at the Rhino-owned emitter boundary', () => {
    assert.match(packager, /WritePackagePlan/);
    assert.match(packager, /BrepiaGrasshopperPackagePlan\.Parse\(packagePlanJson\)/);
    assert.match(packager, /WritePlan\(/);
    assert.match(cli, /--plan/);
    assert.match(cli, /WritePackagePlan\(inputJson, outputPath\)/);
    assert.match(cli, /GeneratedControlCount/);
  });

  it('keeps Rhino-hosted package code on the exact pinned Rhino 8 SDK pair', () => {
    assert.match(cliProject, /<TargetFramework>net8\.0<\/TargetFramework>/);
    assert.match(cliProject, /RhinoCommon" Version="8\.34\.26223\.11001"/);
    assert.match(cliProject, /Grasshopper" Version="8\.34\.26223\.11001"/);
    assert.match(cliProject, /Brepia\.Grasshopper\.csproj/);
    assert.match(cli, /BrepiaGrasshopperDocumentPackager\.Write/);
    assert.match(cli, /brepia-grasshopper-package-result/);
  });

  it('builds the Rhino-hosted packaging code on Linux and Windows without executing an unsupported standalone Rhino host', () => {
    assert.match(workflow, /package-build:/);
    assert.match(workflow, /ubuntu-latest/);
    assert.match(workflow, /windows-latest/);
    assert.match(workflow, /Brepia\.Grasshopper\.Packager\.csproj/);
    assert.doesNotMatch(workflow, /gh-io-runtime-proof:/);
    assert.doesNotMatch(
      workflow,
      /dotnet run --project grasshopper\/Brepia\.Grasshopper\.Packager/,
    );
  });
});
