from pathlib import Path


def replace_all(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    text = p.read_text()
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'missing expected fixture in {path}: {old!r}')
        text = text.replace(old, new)
    p.write_text(text)


replace_all(
    'tests/opencodePersistentSession.test.ts',
    [
        (
            "              code: 'width = 40;\\nheight = 20;\\ncube([width, width, height]);',",
            "              project: project(\n"
            "                'width = 40;\\nheight = 20;\\ncube([width, width, height]);',\n"
            "              ),",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[0] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[0]) },",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[1] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[1]) },",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[2] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[2]) },",
        ),
        (
            "input: { title: 'Box', version: 'v1', code: codes[3] },",
            "input: { title: 'Box', version: 'v1', project: project(codes[3]) },",
        ),
    ],
)

# The generic project-test codemod already converts the simple
# `code: codes[turn - 1]` CLI fixture. Only the comma-containing string
# fixtures need explicit conversion here.
replace_all(
    'tests/cliAgentPersistentSession.test.ts',
    [
        (
            "              code: 'cube([10,10,10]);',",
            "              project: project('cube([10,10,10]);'),",
        ),
        (
            "              code: 'width = 20;\\ncube([width, 20, 10]);',",
            "              project: project('width = 20;\\ncube([width, 20, 10]);'),",
        ),
    ],
)

# This colocated node:test suite is part of TypeScript compilation even though
# Vitest does not execute it. Keep it aligned with the same strict project-only
# final-result protocol.
Path('src/server/opencodeAgentResult.test.ts').write_text(r'''import assert from 'node:assert/strict';
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
''')

print('Step 5 remaining project fixtures fixed')
