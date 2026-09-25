import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const librarySource = fs.readFileSync(
  new URL('../src/components/brep/BrepModelLibrary.tsx', import.meta.url),
  'utf8',
);
const projectViewSource = fs.readFileSync(
  new URL('../src/views/BrepProjectView.tsx', import.meta.url),
  'utf8',
);
const projectServiceSource = fs.readFileSync(
  new URL('../src/services/brepProjectService.ts', import.meta.url),
  'utf8',
);

describe('Phase C4 template project lifecycle acceptance', () => {
  it('navigates a successful template creation into the ordinary BRep project route', () => {
    assert.match(
      librarySource,
      /createBrepProjectConversationFromTemplate/,
    );
    assert.match(
      librarySource,
      /navigate\(\{ to: '\/brep\/\$id', params: \{ id: conversationId \} \}\)/,
    );
  });

  it('opens and edits persisted projects without a template catalog dependency', () => {
    assert.match(projectViewSource, /BrepProjectEditorProvider/);
    assert.match(projectViewSource, /persistBrepProjectParameterRevision/);
    assert.match(projectViewSource, /persistBrepProjectSourceRevision/);
    assert.doesNotMatch(projectViewSource, /productTemplate/);
    assert.doesNotMatch(projectViewSource, /builtinProductTemplateCatalog/);
  });

  it('keeps later immutable revision persistence template-agnostic', () => {
    assert.match(projectServiceSource, /persistNormalizedBrepProjectRevision/);
    assert.match(projectServiceSource, /persistBrepProjectParameterRevision/);
    assert.match(projectServiceSource, /persistBrepProjectSourceRevision/);

    const ordinaryRevisionSource = projectServiceSource.slice(
      projectServiceSource.indexOf('async function persistNormalizedBrepProjectRevision'),
    );
    assert.doesNotMatch(ordinaryRevisionSource, /requireExact/);
    assert.doesNotMatch(ordinaryRevisionSource, /materializeBuiltinProductTemplate/);
  });

  it('preserves ordinary scratch/import creation semantics', () => {
    assert.match(projectServiceSource, /export async function createBrepProjectConversation\(/);
    assert.match(projectServiceSource, /export async function importBrepProjectConversation\(/);
    assert.match(
      projectServiceSource,
      /project: projectPackage\.source\.source/,
    );
  });
});
