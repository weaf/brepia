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
  it('packages one embedded Brepia component through GH_IO without solving geometry', () => {
    assert.match(packager, /new BrepiaProjectComponent\(\)/);
    assert.match(packager, /LoadContractJson\(contract\.NormalizedJson\)/);
    assert.match(packager, /new GH_Document\(\)/);
    assert.match(packager, /document\.AddObject\(component, update: false\)/);
    assert.match(packager, /archive\.AppendObject\(document, DefinitionArchiveName\)/);
    assert.match(
      packager,
      /archive\.WriteToFile\(fullOutputPath, overwrite: true, rememberPath: false\)/,
    );
    assert.doesNotMatch(packager, /BrepiaSolveRuntime/);
    assert.doesNotMatch(packager, /EvaluateThreeDmAsync/);
  });

  it('uses stable project and revision identity and validates the written archive', () => {
    assert.match(packager, /SHA256\.HashData/);
    assert.match(packager, /contract\.ProjectId/);
    assert.match(packager, /contract\.SourceRevisionId/);
    assert.match(packager, /component\.NewInstanceGuid\(componentInstanceId\)/);
    assert.match(packager, /archive\.ReadFromFile\(path\)/);
    assert.match(packager, /archive\.Serialize_Xml\(\)/);
    assert.match(packager, /brepia\.contract\.v1/);
  });

  it('keeps the packager on the exact pinned Rhino 8 SDK pair', () => {
    assert.match(cliProject, /<TargetFramework>net8\.0<\/TargetFramework>/);
    assert.match(cliProject, /RhinoCommon" Version="8\.34\.26223\.11001"/);
    assert.match(cliProject, /Grasshopper" Version="8\.34\.26223\.11001"/);
    assert.match(cliProject, /Brepia\.Grasshopper\.csproj/);
    assert.match(cli, /BrepiaGrasshopperDocumentPackager\.Write/);
    assert.match(cli, /brepia-grasshopper-package-result/);
  });

  it('probes headless serialization on both Linux and Windows CI', () => {
    assert.match(workflow, /package-proof:/);
    assert.match(workflow, /ubuntu-latest/);
    assert.match(workflow, /windows-latest/);
    assert.match(workflow, /Brepia\.Grasshopper\.Packager\.csproj/);
    assert.match(workflow, /cabinet-a42\.brepia-grasshopper\.json/);
    assert.match(workflow, /brepia-grasshopper-gh-\$\{\{ runner\.os \}\}/);
  });
});
