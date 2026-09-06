import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const editor = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);

describe('BRep Grasshopper product export surface', () => {
  it('adds the generated Grasshopper contract beside the existing BRep downloads', () => {
    assert.match(
      editor,
      /type BrepDownloadFormat = 'step' \| '3dm' \| 'brep' \| 'grasshopper'/,
    );
    assert.match(editor, />\.STEP</);
    assert.match(editor, />\.3DM</);
    assert.match(editor, />\.BREP JSON</);
    assert.match(editor, />\.GH CONTRACT</);
    assert.match(editor, /Grasshopper interoperability/);
  });

  it('exports the saved canonical source with immutable revision provenance', () => {
    assert.match(editor, /createBrepGrasshopperContract\(\{/);
    assert.match(editor, /project,\s*sourceRevisionId: activeRevisionId,/s);
    assert.match(
      editor,
      /Grasshopper contract export requires an active immutable BRep revision/,
    );
    assert.match(editor, /serializeBrepGrasshopperContract/);
    assert.match(editor, /\.brepia-grasshopper\.json/);
  });

  it('requires saved parameter state for canonical and Grasshopper JSON but preserves native preview export behavior', () => {
    assert.match(editor, /const brepAvailable = !dirty && !saving && !sourceSaving/);
    assert.match(
      editor,
      /const grasshopperAvailable = brepAvailable && Boolean\(activeRevisionId\)/,
    );
    assert.match(editor, /exportBrepStep\(project, values\)/);
    assert.match(editor, /exportBrep3dm\(project, values\)/);
    assert.match(
      editor,
      /Save the parameter draft before exporting the canonical BRep project\s*package or Grasshopper contract\. STEP and 3DM can still export the\s*current preview values\./s,
    );
  });
});
