import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const definitionSource = fs.readFileSync(
  new URL(
    '../src/components/brep/BrepProjectDefinitionFieldsEditor.tsx',
    import.meta.url,
  ),
  'utf8',
);
const projectEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);

describe('BRep project-definition UI boundary', () => {
  it('exposes identity, published parameters, placement, and metadata in one guarded editor', () => {
    assert.match(definitionSource, /Project definition/);
    assert.match(definitionSource, /Stable project ID/);
    assert.match(definitionSource, /Published parameters/);
    assert.match(definitionSource, /Placement plane/);
    assert.match(definitionSource, /Object metadata/);
    assert.match(definitionSource, /Save project definition/);
    assert.match(definitionSource, /replaceBrepProjectDefinition/);
    assert.match(definitionSource, /brepProjectParameterUsages/);
    assert.match(definitionSource, /suggestBrepParameterId/);
  });

  it('keeps placement semantics explicit instead of implying a native preview transform', () => {
    assert.match(
      definitionSource,
      /does not move the local native preview geometry/,
    );
    assert.match(
      definitionSource,
      /future Grasshopper\/project\s+composition/,
    );
  });

  it('routes definition writes through the existing source-save guard and stays compact in the panel', () => {
    assert.match(projectEditorSource, /<BrepProjectDefinitionEditor/);
    assert.match(projectEditorSource, /onSaveProject=\{saveProjectSource\}/);
    assert.match(projectEditorSource, /disabled=\{featureEditingDisabled\}/);
    assert.match(definitionSource, /const \[open, setOpen\] = useState\(false\)/);
    assert.doesNotMatch(definitionSource, /onProjectSourceCommit/);
    assert.doesNotMatch(definitionSource, /supabase/);
  });

  it('keeps existing parameter IDs stable and blocks destructive referenced-parameter edits', () => {
    assert.match(definitionSource, /readOnly=\{existing\}/);
    assert.match(definitionSource, /disabled=\{disabled \|\| referenced\}/);
    assert.match(
      definitionSource,
      /disabled=\{disabled \|\| \(existing && referenced\)\}/,
    );
    assert.match(definitionSource, /Rewire those fields before removing/);
  });
});
