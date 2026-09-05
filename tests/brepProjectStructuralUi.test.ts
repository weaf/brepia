import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const graphSource = fs.readFileSync(
  new URL('../src/components/brep/BrepDependencyGraph.tsx', import.meta.url),
  'utf8',
);
const featureEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
  'utf8',
);
const projectEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);

describe('BRep structural DAG authoring UI boundary', () => {
  it('offers explicit create, result selection, and confirmed safe delete intents', () => {
    assert.match(featureEditorSource, /addBrepProjectNode/);
    assert.match(featureEditorSource, /setBrepProjectResultNode/);
    assert.match(featureEditorSource, /deleteBrepProjectNode/);
    assert.match(featureEditorSource, /suggestBrepNodeId/);
    assert.match(featureEditorSource, /aria-label="Add BRep feature"/);
    assert.match(featureEditorSource, /Stable node ID/);
    assert.match(featureEditorSource, /Create feature revision/);

    assert.match(graphSource, /Set result/);
    assert.match(graphSource, /Delete feature/);
    assert.match(graphSource, /AlertDialog/);
    assert.match(graphSource, /Select another result before deleting/);
    assert.match(graphSource, /Rewire .* before deleting this feature/);
  });

  it('keeps graph actions declarative and routes structural writes through the guarded source commit', () => {
    assert.doesNotMatch(graphSource, /onProjectSourceCommit/);
    assert.doesNotMatch(graphSource, /@shared\/brepProjectEditing/);
    assert.match(featureEditorSource, /onSaveProject\(nextProject\)/);
    assert.match(featureEditorSource, /onSaveProject\(setBrepProjectResultNode/);
    assert.match(featureEditorSource, /onSaveProject\(deleteBrepProjectNode/);

    assert.match(projectEditorSource, /saveProjectSource/);
    assert.match(projectEditorSource, /onSaveProject=\{saveProjectSource\}/);
    assert.match(projectEditorSource, /sourceEditingDisabled/);
    assert.match(projectEditorSource, /Save or discard the parameter preview/);
    assert.match(projectEditorSource, /Another BRep project update is already in progress/);
  });

  it('keeps all current node types available while subtract requires enough existing inputs', () => {
    for (const type of ['box', 'cylinder', 'transform', 'subtract', 'fillet']) {
      assert.match(featureEditorSource, new RegExp(`'${type}'`));
    }
    assert.match(
      featureEditorSource,
      /type === 'subtract' && project\.nodes\.length < 2/,
    );
    assert.match(
      featureEditorSource,
      /Subtract creation requires at least two existing BRep features/,
    );
  });
});
