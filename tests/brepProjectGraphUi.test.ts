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

describe('BRep graph/editor UI boundary', () => {
  it('renders a presentation-only dependency graph with explicit result flow navigation', () => {
    assert.match(graphSource, /buildBrepDependencyGraph\(project\)/);
    assert.match(graphSource, /aria-label="BRep dependency graph"/);
    assert.match(graphSource, /graph\.edges\.map/);
    assert.match(graphSource, /Inputs/);
    assert.match(graphSource, /Used by/);
    assert.match(graphSource, /Final result/);
    assert.match(graphSource, /aria-pressed=\{selected\}/);
    assert.doesNotMatch(graphSource, /onProjectSourceCommit/);
    assert.doesNotMatch(graphSource, /replaceExistingBrepProjectNode/);
  });

  it('keeps graph selection synchronized with the existing feature inspector while editing remains separately guarded', () => {
    assert.match(featureEditorSource, /selectedNodeId/);
    assert.match(featureEditorSource, /<BrepDependencyGraph/);
    assert.match(featureEditorSource, /onSelectNode=\{setSelectedNodeId\}/);
    assert.match(featureEditorSource, /editingDisabled=\{disabled \|\| saving\}/);
    assert.match(featureEditorSource, /setSelectedNodeId\(node\.id\)/);
    assert.match(
      featureEditorSource,
      /Dependency navigation remains available\. Save or discard competing/,
    );
  });

  it('uses a bounded single-column graph on mobile instead of clipping desktop topology', () => {
    assert.match(graphSource, /useIsMobile\(\)/);
    assert.match(graphSource, /layoutGraph\(graph, isMobile\)/);
    assert.match(graphSource, /MOBILE_NODE_WIDTH/);
    assert.match(graphSource, /orderedNodes/);
    assert.match(graphSource, /overflow-x-hidden overflow-y-auto/);
    assert.match(graphSource, /marginInline: 'auto'/);
  });
});
