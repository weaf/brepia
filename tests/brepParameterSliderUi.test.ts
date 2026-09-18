import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const editorSource = fs.readFileSync(
  new URL('../src/components/brep/BrepProjectEditor.tsx', import.meta.url),
  'utf8',
);

describe('BRep bounded parameter slider UI', () => {
  it('adds a range slider only when a finite increasing min/max interval exists', () => {
    assert.match(editorSource, /const hasSliderRange =/);
    assert.match(editorSource, /Number\.isFinite\(parameter\.min\)/);
    assert.match(editorSource, /Number\.isFinite\(parameter\.max\)/);
    assert.match(editorSource, /parameter\.max > parameter\.min/);
    assert.match(editorSource, /\{hasSliderRange \? \(/);
    assert.match(editorSource, /type="range"/);
  });

  it('keeps exact numeric entry and the slider on the same canonical bounds and step', () => {
    const minBindings = editorSource.match(/min=\{parameter\.min\}/g) ?? [];
    const maxBindings = editorSource.match(/max=\{parameter\.max\}/g) ?? [];
    const stepBindings = editorSource.match(/step=\{parameter\.step\}/g) ?? [];

    assert.ok(minBindings.length >= 2);
    assert.ok(maxBindings.length >= 2);
    assert.ok(stepBindings.length >= 2);
    assert.match(editorSource, /type="number"/);
    assert.match(editorSource, /aria-label=\{`\$\{parameter\.label\} slider`\}/);
    assert.match(editorSource, /aria-label=\{`\$\{parameter\.label\} value`\}/);
  });

  it('routes both controls through the existing live-preview parameter state', () => {
    const parameterUpdates =
      editorSource.match(/setParameterValue\(\s*parameter\.id,/g) ?? [];

    assert.ok(parameterUpdates.length >= 2);
    assert.match(editorSource, /const parameterEditingDisabled = saving \|\| sourceSaving \|\| exporting/);
    assert.match(editorSource, /BREP_EVALUATION_DEBOUNCE_MS = 120/);
  });
});
