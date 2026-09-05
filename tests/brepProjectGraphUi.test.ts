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
const workspaceSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectWorkspacePanel.tsx', import.meta.url),
  'utf8',
);
const projectViewSource = fs.readFileSync(
  new URL('../src/views/BrepProjectView.tsx', import.meta.url),
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

  it('moves the graph into the main Model Graph workspace instead of constraining it to the Parameters panel', () => {
    assert.match(workspaceSource, />\s*Model\s*</);
    assert.match(workspaceSource, />\s*Graph\s*</);
    assert.match(workspaceSource, /BREP_GRAPH_WORKSPACE_TARGET_ID/);
    assert.match(projectViewSource, /<BrepFeatureWorkspaceProvider>/);
    assert.match(projectViewSource, /previewSlot=\{<BrepProjectWorkspacePanel \/>\}/);
    assert.match(
      projectViewSource,
      /mobilePreviewSlot=\{<BrepProjectWorkspacePanel isMobile \/>\}/,
    );

    assert.match(featureEditorSource, /createPortal\(graph, graphTarget\)/);
    assert.match(featureEditorSource, /Open BRep dependency graph/);
    assert.match(featureEditorSource, /not constrained by the Parameters panel width/);
    assert.match(graphSource, /fillAvailable/);
    assert.doesNotMatch(graphSource, /ResizeObserver/);
    assert.doesNotMatch(graphSource, /useIsMobile/);
  });
});
