import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const containerfile = fs.readFileSync(
  new URL('../scripts/brep/Containerfile', import.meta.url),
  'utf8',
);
const driver = fs.readFileSync(
  new URL('../scripts/brep/brep_driver.py', import.meta.url),
  'utf8',
);
const server = fs.readFileSync(
  new URL('../src/server/brepEvaluation.ts', import.meta.url),
  'utf8',
);
const route = fs.readFileSync(
  new URL('../src/routes/api/brep/export.step.ts', import.meta.url),
  'utf8',
);
const service = fs.readFileSync(
  new URL('../src/services/brepStepExport.ts', import.meta.url),
  'utf8',
);

describe('BRep Rhino/openNURBS interoperability contract', () => {
  it('pins rhino3dm inside the isolated Python 3.12 native sandbox', () => {
    assert.match(containerfile, /ARG RHINO3DM_VERSION=8\.32\.1/);
    assert.match(containerfile, /rhino3dm==\$\{RHINO3DM_VERSION\}/);
    assert.match(containerfile, /m\.version\('rhino3dm'\)/);
  });

  it('writes native 3DM semantics without pretending tessellation is exact BRep conversion', () => {
    assert.match(driver, /rhino3dm\.File3dm\(\)/);
    assert.match(driver, /UnitSystem\.Millimeters/);
    assert.match(driver, /brepia\.geometryRepresentation/);
    assert.match(driver, /tessellated-mesh/);
    assert.match(driver, /EmbeddedFile\.Read/);
    assert.match(driver, /brepia-primary\.step/);
    assert.doesNotMatch(driver, /Brep\.CreateFromMesh/);
  });

  it('bounds and validates 3DM before exposing it to the application', () => {
    assert.match(server, /threeDmBytes\?: Uint8Array/);
    assert.match(server, /BREP_EVALUATION_OUTPUT_LIMIT_BYTES/);
    assert.match(server, /3D Geometry File Format /);
    assert.match(server, /exportBrepProjectTo3dm/);
  });

  it('keeps STEP compatibility while negotiating 3DM on the existing native export boundary', () => {
    assert.match(route, /model\/vnd\.3dm/);
    assert.match(route, /exportBrepProjectTo3dm/);
    assert.match(route, /exportBrepProjectToStep/);
    assert.match(route, /X-PCAD-3DM-Provider/);
    assert.match(service, /Accept: format === '3dm'/);
    assert.match(service, /exportBrep3dm/);
  });
});
