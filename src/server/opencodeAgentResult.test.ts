import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAgentResult } from './opencodeAgentResult.ts';
import type { OpenScadProject } from '@shared/openScadProject';

function project(content = 'cube([10,10,10]);'): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath: 'main.scad',
    files: [
      { path: 'lib/support.scad', content: 'module support() { sphere(2); }' },
      { path: 'main.scad', content },
    ],
  };
}

describe('R04B shared final-result parser (opencodeAgentResult)', () => {
  it('extracts and normalizes a complete project JSON payload', () => {
    const expected = project();
    const result = parseAgentResult(
      JSON.stringify({ project: expected, message: 'Model ready' }),
    );
    assert.deepEqual(result.project, {
      ...expected,
      files: [...expected.files].sort((a, b) =>
        a.path.localeCompare(b.path, 'en-US'),
      ),
    });
    assert.equal(result.message, 'Model ready');
  });

  it('uses the final complete project when an agent corrects a draft', () => {
    const draft = project('cube([5,5,5]);');
    const final = project('cube([20,20,20]);');
    const result = parseAgentResult(
      `${JSON.stringify({ project: draft, message: 'Draft' })}\nCorrection:\n${JSON.stringify({ project: final, message: 'Fixed' })}`,
    );
    assert.equal(result.project?.entrypointPath, 'main.scad');
    assert.equal(
      result.project?.files.find((file) => file.path === 'main.scad')?.content,
      'cube([20,20,20]);',
    );
    assert.equal(result.message, 'Fixed');
  });

  it('rejects the legacy top-level code artifact contract', () => {
    const response = JSON.stringify({ code: 'cube(10);', message: 'legacy' });
    const result = parseAgentResult(response);
    assert.equal(result.project, undefined);
    assert.equal(result.message, response);
  });

  describe('parser invariant — plain prose is NOT a project', () => {
    const proseExamples = [
      'The cube is already centered.',
      'Rotate the part 90 degrees before printing.',
      'I would keep the cylinder as-is.',
    ];

    for (const prose of proseExamples) {
      it(`produces no project for: "${prose}"`, () => {
        const result = parseAgentResult(prose);
        assert.equal(result.project, undefined);
        assert.equal(result.message, prose);
      });
    }
  });
});
