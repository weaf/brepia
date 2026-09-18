import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const extractor = fs.readFileSync(
  new URL(
    '../grasshopper/Brepia.Grasshopper/Packaging/BrepiaGrasshopperReconciliationExtractor.cs',
    import.meta.url,
  ),
  'utf8',
);

describe('BRep Phase 8D Grasshopper reconciliation extractor boundary', () => {
  it('recognizes Brepia ownership from the embedded smart component contract without solving geometry', () => {
    assert.match(extractor, /OfType<BrepiaProjectComponent>\(\)/);
    assert.match(extractor, /component\.Contract is not null/);
    assert.match(extractor, /BrepiaGrasshopperPackagePlan\.Create\(contract\)/);
    assert.match(extractor, /component\.InstanceGuid == plan\.Component\.InstanceGuid/);
    assert.doesNotMatch(extractor, /BrepiaSolveRuntime/);
    assert.doesNotMatch(extractor, /EvaluateThreeDmAsync/);
    assert.doesNotMatch(extractor, /NewSolution\(/);
    assert.doesNotMatch(extractor, /ExpireSolution\(/);
  });

  it('recovers numeric values only from observable Grasshopper numeric state', () => {
    assert.match(extractor, /sourceObject is GH_NumberSlider slider/);
    assert.match(extractor, /slider\.Slider\.Value/);
    assert.match(extractor, /sourceObject is Param_Number numberParameter/);
    assert.match(extractor, /PersistentData/);
    assert.match(extractor, /OfType<GH_Number>\(\)/);
    assert.match(extractor, /source\.VolatileData/);
    assert.match(extractor, /volatileNumbers\.Length == 1 \? volatileNumbers\[0\]\.Value : null/);
    assert.match(extractor, /value is null \? "unresolved" : "resolved"/);
  });

  it('validates recovered values against canonical Brepia parameter bounds', () => {
    assert.match(extractor, /ValidateCanonicalValue/);
    assert.match(extractor, /double\.IsFinite\(value\)/);
    assert.match(extractor, /value < min/);
    assert.match(extractor, /value > max/);
    assert.match(extractor, /violates its canonical bounds/);
  });

  it('keeps project placement unless an actual Grasshopper source is connected', () => {
    assert.match(extractor, /var placementInput = component\.Params\.Input\[\^1\]/);
    assert.match(extractor, /mode = "project-placement"/);
    assert.match(extractor, /mode = "grasshopper-source"/);
  });

  it('captures external objects and parameter-level wires as evidence only', () => {
    assert.match(extractor, /MaxExternalObjects = 2_048/);
    assert.match(extractor, /MaxExternalConnections = 8_192/);
    assert.match(extractor, /authority = "evidence-only"/);
    assert.match(extractor, /completeness = "document-scan"/);
    assert.match(extractor, /fromParamGuid/);
    assert.match(extractor, /toParamGuid/);
    assert.match(extractor, /BuildParameterOwnerMap/);
  });

  it('excludes internal generated Brepia wiring from external graph evidence', () => {
    assert.match(extractor, /brepiaOwnedObjectGuids\.Contains\(sourceOwnerGuid\.Value\)/);
    assert.match(extractor, /brepiaOwnedObjectGuids\.Contains\(targetOwnerGuid\.Value\)/);
    assert.match(extractor, /continue;/);
  });

  it('supports targeting one Brepia instance and fails closed on ambiguous document ownership', () => {
    assert.match(extractor, /Guid\? componentInstanceGuid = null/);
    assert.match(extractor, /candidates\.Length != 1/);
    assert.match(extractor, /Expected exactly one Brepia Project component/);
  });
});
