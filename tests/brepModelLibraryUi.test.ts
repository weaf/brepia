import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const librarySource = fs.readFileSync(
  new URL('../src/components/brep/BrepModelLibrary.tsx', import.meta.url),
  'utf8',
);
const routeSource = fs.readFileSync(
  new URL('../src/routes/_layout/_auth/brep/index.tsx', import.meta.url),
  'utf8',
);
const sidebarSource = fs.readFileSync(
  new URL('../src/components/Sidebar.tsx', import.meta.url),
  'utf8',
);

describe('saved BRep model library product surface', () => {
  it('repurposes the old BRep sample-creation route as a model library', () => {
    assert.match(routeSource, /BrepModelLibrary/);
    assert.doesNotMatch(routeSource, /BrepProjectPreview/);
    assert.doesNotMatch(routeSource, /createProject/);

    assert.match(librarySource, /BRep Models/);
    assert.match(librarySource, /Saved BRep models/);
    assert.match(librarySource, /parametricSourceKind === 'brep'/);
    assert.match(librarySource, /to: '\/brep\/\$id'/);
    assert.match(librarySource, /New Creation/);
  });

  it('keeps package import while removing the obsolete dedicated creation entry', () => {
    assert.match(librarySource, /Import model/);
    assert.match(librarySource, /parseBrepProjectPackageJson/);
    assert.match(librarySource, /BREP_PROJECT_PACKAGE_MAX_BYTES/);
    assert.match(librarySource, /importBrepProjectConversation/);

    assert.match(sidebarSource, /Saved native BRep models/);
    assert.match(sidebarSource, /BRep Models/);
    assert.doesNotMatch(sidebarSource, /New native BRep project/);
    assert.doesNotMatch(sidebarSource, /'New BRep project'/);
  });
});
