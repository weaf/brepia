import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

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

describe('BRep Phase 8A Grasshopper packaging boundary', () => {
  it('defines one embedded Brepia component package without solving geometry', () => {
    assert.match(packager, /new BrepiaProjectComponent\(\)/);
    assert.match(packager, /LoadContractJson\(contract\.NormalizedJson\)/);
    assert.match(packager, /new GH_Document\(\)/);
    assert.match(packager, /document\.AddObject\(component, update: false\)/);
    assert.match(packager, /archive\.AppendObject\(document, DefinitionArchiveName\)/);
    assert.match(packager, /archive\.Serialize_Binary\(\)/);
    assert.match(packager, /File\.WriteAllBytes\(fullOutputPath, binary\)/);
    assert.doesNotMatch(packager, /archive\.WriteToFile/);
    assert.doesNotMatch(packager, /BrepiaSolveRuntime/);
    assert.doesNotMatch(packager, /EvaluateThreeDmAsync/);
  });

  it('keeps GH object identity stable by project while retaining revision provenance', () => {
    assert.match(packager, /InstanceGuidNamespace = "brepia-grasshopper-package-plan-v1"/);
    assert.match(packager, /SHA256\.HashData/);
    assert.match(packager, /StableGuid\(contract\.ProjectId, "brepia-project"\)/);
    assert.match(packager, /contract\.SourceRevisionId/);
    assert.match(packager, /component\.NewInstanceGuid\(componentInstanceId\)/);
    assert.match(packager, /archive\.Deserialize_Binary\(binary\)/);
    assert.match(packager, /archive\.Serialize_Xml\(\)/);
    assert.match(packager, /brepia\.contract\.v1/);
    assert.doesNotMatch(
      packager,
      /StableGuid\([^)]*SourceRevisionId[^)]*\)/,
    );
  });

  it('keeps Rhino-hosted package code on the exact pinned Rhino 8 SDK pair', () => {
    assert.match(cliProject, /<TargetFramework>net8\.0<\/TargetFramework>/);
    assert.match(cliProject, /RhinoCommon" Version="8\.34\.26223\.11001"/);
    assert.match(cliProject, /Grasshopper" Version="8\.34\.26223\.11001"/);
    assert.match(cliProject, /Brepia\.Grasshopper\.csproj/);
    assert.match(cli, /BrepiaGrasshopperDocumentPackager\.Write/);
    assert.match(cli, /brepia-grasshopper-package-result/);
  });

  it('builds Rhino-hosted package code on both Linux and Windows without executing an unsupported standalone Rhino host', () => {
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
