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

  it('keeps all current node types available while bounded composition types enforce authoring prerequisites', () => {
    for (const type of [
      'box',
      'cylinder',
      'transform',
      'mirror',
      'linearPattern',
      'rectangularPattern',
      'circularPattern',
      'subtract',
      'union',
      'intersect',
      'fillet',
    ]) {
      assert.match(featureEditorSource, new RegExp(`'${type}'`));
    }
    assert.match(
      featureEditorSource,
      /type === 'linearPattern' \|\|\s+type === 'rectangularPattern' \|\|\s+type === 'circularPattern'/,
    );
    assert.match(
      featureEditorSource,
      /type === 'subtract' && project\.nodes\.length < 2/,
    );
    assert.match(
      featureEditorSource,
      /type === 'union' \|\| type === 'intersect'/,
    );
    assert.match(
      featureEditorSource,
      /Subtract creation requires at least two existing BRep features/,
    );
  });

  it('exposes the M3B linear pattern controls without weakening value-kind boundaries', () => {
    assert.match(featureEditorSource, /case 'linearPattern'/);
    assert.match(featureEditorSource, /Pattern axis/);
    assert.match(featureEditorSource, /Instance count/);
    assert.match(featureEditorSource, /min=\{2\}/);
    assert.match(featureEditorSource, /max=\{BREP_PROJECT_MAX_PATTERN_COUNT\}/);
    assert.match(featureEditorSource, /Center-to-center spacing/);
    assert.match(featureEditorSource, /Spacing must resolve to a non-zero/);
    assert.match(featureEditorSource, /valueKind="single"/);
    assert.match(featureEditorSource, /brepNodeValueKind\(candidate\) === 'instanceSet'/);
    assert.match(featureEditorSource, /pattern instance set/);
    assert.match(featureEditorSource, /canonical\s+index order/);
    assert.match(featureEditorSource, /Instance set/);
  });

  it('exposes bounded M3C rectangular pattern authoring controls', () => {
    assert.match(featureEditorSource, /case 'rectangularPattern'/);
    assert.match(featureEditorSource, /Rectangular pattern/);
    assert.match(featureEditorSource, /Pattern axis A/);
    assert.match(featureEditorSource, /Pattern axis B/);
    assert.match(featureEditorSource, /Count A/);
    assert.match(featureEditorSource, /Count B/);
    assert.match(featureEditorSource, /Spacing A/);
    assert.match(featureEditorSource, /Spacing B/);
    assert.match(featureEditorSource, /BREP_PROJECT_MAX_RECTANGULAR_PATTERN_INSTANCES/);
    assert.match(featureEditorSource, /row-major with A outer, B inner/);
    assert.match(featureEditorSource, /valueKind="single"/);
  });

  it('exposes bounded M3D circular pattern authoring controls without a second collection model', () => {
    assert.match(featureEditorSource, /case 'circularPattern'/);
    assert.match(featureEditorSource, /Circular pattern/);
    assert.match(featureEditorSource, /Pattern center/);
    assert.match(featureEditorSource, /Angle step/);
    assert.match(featureEditorSource, /unit="deg"/);
    assert.match(featureEditorSource, /angleStepDeg/);
    assert.match(featureEditorSource, /count: 6/);
    assert.match(featureEditorSource, /angleStepDeg: 60/);
    assert.match(featureEditorSource, /right-hand rotation/);
    assert.match(featureEditorSource, /must not exceed 360°/);
    assert.match(featureEditorSource, /valueKind="single"/);
    assert.doesNotMatch(featureEditorSource, /startAngleDeg/);
    assert.doesNotMatch(featureEditorSource, /totalAngleDeg/);
  });
});
