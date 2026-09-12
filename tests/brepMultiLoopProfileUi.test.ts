import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const source = fs.readFileSync(
  new URL('../src/components/brep/BrepMultiLoopProfileEditor.tsx', import.meta.url),
  'utf8',
);
const wrapper = fs.readFileSync(
  new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
  'utf8',
);

describe('bounded multi-loop structural profile UI', () => {
  it('mounts the bounded hole editor beside the existing feature editor', () => {
    assert.match(wrapper, /BrepFeatureEditorLegacy/);
    assert.match(wrapper, /BrepMultiLoopProfileEditor/);
    assert.match(wrapper, /onSaveNode=\{onSaveNode\}/);
  });

  it('keeps hole authoring bounded, ordered and extrusion-only', () => {
    assert.match(source, /node\.type === 'extrude'/);
    assert.match(source, /BREP_PROJECT_MAX_PROFILE_HOLES/);
    assert.match(source, /Add hole/);
    assert.match(source, /Move hole .* up/);
    assert.match(source, /Move hole .* down/);
    assert.match(source, /updateHoles/);
    assert.match(source, /ordered, non-recursive loops/);
    assert.doesNotMatch(source, /node\.type === 'revolve'/);
  });

  it('edits all bounded loop families and local U\/V offsets without materializing expressions', () => {
    assert.match(source, /Hole profile type/);
    assert.match(source, /Rectangle/);
    assert.match(source, /Circle/);
    assert.match(source, /Closed polyline/);
    assert.match(source, /label="Offset U"/);
    assert.match(source, /label="Offset V"/);
    assert.match(source, /Expression · derived/);
    assert.match(source, /formatBrepScalar\(value\)/);
    assert.match(source, /BREP_PROJECT_MAX_PROFILE_POINTS/);
  });

  it('routes save through the existing immutable node revision path', () => {
    assert.match(source, /await onSaveNode\(draft\)/);
    assert.match(source, /Save hole revision/);
    assert.match(source, /Save rejects touching/);
    assert.match(source, /intersection, nesting and holes outside/);
  });
});
