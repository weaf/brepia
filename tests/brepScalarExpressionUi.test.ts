import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const featureEditorSource = [
  '../src/components/brep/BrepFeatureEditor.tsx',
  '../src/components/brep/BrepFeatureEditorLegacy.tsx',
  '../src/components/brep/BrepMultiLoopProfileEditor.tsx',
]
  .map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n');

const editorSources = [
  featureEditorSource,
  '../src/components/brep/BrepProjectDefinitionFieldsEditor.tsx',
  '../src/components/brep/BrepProjectObjectEditor.tsx',
].map((source) =>
  source.startsWith('../')
    ? fs.readFileSync(new URL(source, import.meta.url), 'utf8')
    : source,
);

describe('BRep M1 expression-preserving editor boundary', () => {
  it('distinguishes derived expressions from literals and direct parameter references in every scalar editor', () => {
    for (const source of editorSources) {
      assert.match(source, /const EXPRESSION_VALUE = '__expression__'/);
      assert.match(source, /Expression · derived/);
      assert.match(source, /isBrepParameterReference/);
      assert.match(source, /formatBrepScalar/);
      assert.doesNotMatch(source, /value\.parameter/);
    }
  });

  it('does not mutate an expression merely because its derived select option is selected', () => {
    for (const source of editorSources) {
      assert.match(
        source,
        /if \(event\.target\.value === EXPRESSION_VALUE\) return;/,
      );
    }
  });
});
