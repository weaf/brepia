import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const editor = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);

describe('BRep Grasshopper product export surface', () => {
  it('offers executable GHX beside the existing BRep downloads', () => {
    assert.match(
      editor,
      /type BrepDownloadFormat = 'step' \| '3dm' \| 'brep' \| 'ghx'/,
    );
    assert.match(editor, />\.STEP</);
    assert.match(editor, />\.3DM</);
    assert.match(editor, />\.BREP JSON</);
    assert.match(editor, />\.GHX</);
    assert.match(editor, /Editable Grasshopper model/);
    assert.doesNotMatch(editor, />\.GH CONTRACT</);
  });

  it('exports saved canonical source with immutable revision provenance through the portable GHX compiler', () => {
    assert.match(
      editor,
      /exportBrepGrasshopperGhx\(project, activeRevisionId\)/,
    );
    assert.match(
      editor,
      /Grasshopper GHX export requires an active immutable BRep revision/,
    );
    assert.match(editor, /mimeType: 'application\/xml'/);
    assert.match(editor, /\.ghx`/);
  });

  it('requires saved parameter state for canonical and GHX exports but preserves native preview export behavior', () => {
    assert.match(
      editor,
      /const brepAvailable = !dirty && !saving && !sourceSaving && !exporting/,
    );
    assert.match(
      editor,
      /const ghxAvailable = brepAvailable && Boolean\(activeRevisionId\)/,
    );
    assert.match(editor, /exportBrepStep\(project, values\)/);
    assert.match(editor, /exportBrep3dm\(project, values\)/);
    assert.match(
      editor,
      /Save the parameter draft before exporting the canonical BRep project\s*package or Grasshopper GHX\. STEP and 3DM can still export the current\s*preview values\./s,
    );
  });
});
