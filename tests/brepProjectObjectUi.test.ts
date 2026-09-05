import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const wrapperSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectDefinitionEditor.tsx', import.meta.url),
  'utf8',
);
const objectSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectObjectEditor.tsx', import.meta.url),
  'utf8',
);
const graphSource = fs.readFileSync(
  new URL('../src/components/brep/BrepDependencyGraph.tsx', import.meta.url),
  'utf8',
);
const projectEditorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);

describe('BRep project-object UI boundary', () => {
  it('composes project-object authoring beside the accepted Phase 4D editor', () => {
    assert.match(wrapperSource, /BrepProjectDefinitionFieldsEditor/);
    assert.match(wrapperSource, /BrepProjectObjectEditor/);
    assert.match(wrapperSource, /onSaveProject=\{onSaveProject\}/);
    assert.match(projectEditorSource, /<BrepProjectDefinitionEditor/);
    assert.match(projectEditorSource, /onSaveProject=\{saveProjectSource\}/);
  });

  it('authors semantic geometry roles and stable local points through canonical helpers', () => {
    assert.match(objectSource, /Project object/);
    assert.match(objectSource, /Footprint/);
    assert.match(objectSource, /Clearance envelope/);
    assert.match(objectSource, /Maintenance envelope/);
    assert.match(objectSource, /Semantic points/);
    assert.match(objectSource, /Stable point ID/);
    assert.match(objectSource, /Connection/);
    assert.match(objectSource, /Mounting/);
    assert.match(objectSource, /Cable/);
    assert.match(objectSource, /Local position · mm/);
    assert.match(objectSource, /Local direction · unitless/);
    assert.match(objectSource, /replaceBrepProjectObjectDefinition/);
    assert.match(objectSource, /suggestBrepProjectObjectPointId/);
    assert.match(objectSource, /readOnly=\{existing\}/);
  });

  it('keeps project-object authoring compact and persistence-free', () => {
    assert.match(objectSource, /const \[open, setOpen\] = useState\(false\)/);
    assert.match(objectSource, /Save project object/);
    assert.match(objectSource, /do not replace Result/);
    assert.match(objectSource, /3D preview continues to show/);
    assert.doesNotMatch(objectSource, /onProjectSourceCommit/);
    assert.doesNotMatch(objectSource, /supabase/);
    assert.doesNotMatch(objectSource, /fetch\(/);
  });

  it('identifies semantic role nodes in the graph and blocks destructive delete until roles are cleared', () => {
    assert.match(graphSource, /Project object: \$\{roleLabels\}/);
    assert.match(graphSource, /Object ·/);
    assert.match(graphSource, /Footprint/);
    assert.match(graphSource, /Clearance envelope/);
    assert.match(graphSource, /Maintenance envelope/);
    assert.match(graphSource, /Clear its project-object role/);
    assert.match(graphSource, /disabled=\{editingDisabled \|\| Boolean\(deleteBlockedReason\)\}/);
    assert.doesNotMatch(graphSource, /replaceBrepProjectObjectDefinition/);
    assert.doesNotMatch(graphSource, /onProjectSourceCommit/);
  });
});
