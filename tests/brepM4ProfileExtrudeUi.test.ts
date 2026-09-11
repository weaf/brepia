import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const featureEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
  'utf8',
);

describe('M4 profile extrusion structural authoring UI', () => {
  it('exposes extrusion as a first-class bounded feature type', () => {
    assert.match(featureEditorSource, /'extrude'/);
    assert.match(featureEditorSource, /case 'extrude'/);
    assert.match(featureEditorSource, /return 'Extrude'/);
    assert.match(featureEditorSource, /profile: defaultExtrudeProfile\('rectangle'\)/);
    assert.match(featureEditorSource, /axis: 'z'/);
  });

  it('edits all three bounded profile variants with scalar-preserving fields', () => {
    assert.match(featureEditorSource, /Profile type/);
    assert.match(featureEditorSource, /Rectangle/);
    assert.match(featureEditorSource, /Circle/);
    assert.match(featureEditorSource, /Closed polyline/);
    assert.match(featureEditorSource, /label="Profile width"/);
    assert.match(featureEditorSource, /label="Profile height"/);
    assert.match(featureEditorSource, /label="Profile radius"/);
    assert.match(featureEditorSource, /label="U"/);
    assert.match(featureEditorSource, /label="V"/);
  });

  it('keeps closed polylines bounded to the canonical 3..32 point surface', () => {
    assert.match(featureEditorSource, /BREP_PROJECT_MAX_PROFILE_POINTS/);
    assert.match(
      featureEditorSource,
      /profile\.points\.length >= BREP_PROJECT_MAX_PROFILE_POINTS/,
    );
    assert.match(featureEditorSource, /profile\.points\.length <= 3/);
    assert.match(featureEditorSource, /Add point/);
    assert.match(featureEditorSource, /zero area and self-intersection/);
  });

  it('makes canonical axis frames and symmetric depth semantics explicit', () => {
    assert.match(featureEditorSource, /Extrusion axis/);
    assert.match(featureEditorSource, /X axis · U=Y, V=Z/);
    assert.match(featureEditorSource, /Y axis · U=Z, V=X/);
    assert.match(featureEditorSource, /Z axis · U=X, V=Y/);
    assert.match(featureEditorSource, /label="Extrusion depth"/);
    assert.match(featureEditorSource, /symmetric from -depth \/ 2 to \+depth \/ 2/);
    assert.match(featureEditorSource, /one single-shape result/);
  });
});
