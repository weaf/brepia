from pathlib import Path
import re

PROJECT_HELPER = """
function project(code: string, support = 'module support_part() { cube(1); }') {
  return {
    schemaVersion: 1 as const,
    entrypointPath: 'main.scad',
    files: [
      { path: 'main.scad', content: code },
      { path: 'lib/support.scad', content: support },
    ],
  };
}
"""


def projectify_persistent_test(path: str, import_anchor: str) -> None:
    p = Path(path)
    text = p.read_text()
    if 'function project(code: string' not in text:
      text = text.replace(import_anchor, import_anchor + PROJECT_HELPER, 1)
    text, count = re.subn(r'(?m)^(\s*)code: ([^,\n]+),$', r'\1project: project(\2),', text)
    if count == 0:
      raise SystemExit(f'no artifact code fixtures replaced in {path}')
    p.write_text(text)


projectify_persistent_test(
    'tests/opencodePersistentSession.test.ts',
    "} from '../src/server/opencode';\n",
)
projectify_persistent_test(
    'tests/cliAgentPersistentSession.test.ts',
    "} from '../src/server/cliAgents';\n",
)

# Strengthen persistent-session assertions around the complete project protocol.
p = Path('tests/opencodePersistentSession.test.ts')
text = p.read_text()
text = text.replace(
    "    assert.match(reused, /width = 40;/);\n",
    "    assert.match(reused, /width = 40;/);\n"
    "    assert.match(reused, /lib\\/support\\.scad/);\n"
    "    assert.match(reused, /module support_part/);\n"
    "    assert.match(reused, /\\\"entrypointPath\\\":\\\"main.scad\\\"/);\n"
    "    assert.doesNotMatch(reused, /<current_pcad_artifact>\\n<openscad>/);\n",
    1,
)
text = text.replace(
    "              project: project(latestCode),\n",
    "              project: project(\n"
    "                latestCode,\n"
    "                'module support_part() { sphere(r = 7); }',\n"
    "              ),\n",
    1,
)
text = text.replace(
    "    assert.match(turnPrompt, /height = 14;/);\n",
    "    assert.match(turnPrompt, /height = 14;/);\n"
    "    assert.match(turnPrompt, /sphere\\(r = 7\\)/);\n"
    "    assert.match(turnPrompt, /lib\\/support\\.scad/);\n",
    1,
)
p.write_text(text)

p = Path('tests/cliAgentPersistentSession.test.ts')
text = p.read_text()
text = text.replace(
    "    assert.match(text, /width = 20;/);\n",
    "    assert.match(text, /width = 20;/);\n"
    "    assert.match(text, /lib\\/support\\.scad/);\n"
    "    assert.match(text, /module support_part/);\n"
    "    assert.match(text, /\\\"entrypointPath\\\":\\\"main.scad\\\"/);\n"
    "    assert.doesNotMatch(text, /<current_pcad_artifact>\\n<openscad>/);\n",
    1,
)
p.write_text(text)

# Result parsing is intentionally strict: external agents return one complete
# normalized project snapshot, never a legacy code field or fenced source.
Path('tests/opencodeAgentResult.test.ts').write_text(r'''import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  finishWithParametricToolCall,
  parseAgentResult,
  parseStructuredAgentResult,
  resolveAgentResultChannels,
} from '../src/server/opencodeAgentResult';
import type { OpenScadProject } from '@shared/openScadProject';

function project(
  entrypoint = 'include <lib/support.scad>;\nsupport_part();',
  support = 'module support_part() { cube([10, 10, 10]); }',
): OpenScadProject {
  return {
    schemaVersion: 1,
    entrypointPath: 'main.scad',
    files: [
      { path: 'lib/support.scad', content: support },
      { path: 'main.scad', content: entrypoint },
    ],
  };
}

const FINISH = {
  type: 'finish' as const,
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage: {
    inputTokens: {
      total: 0,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 0, text: undefined, reasoning: undefined },
  },
};

describe('OpenCode agent project result parsing', () => {
  it('extracts a complete multi-file project after reasoning prose', () => {
    const expected = project();
    const response = [
      'I will revise the support module.',
      JSON.stringify({ project: expected, message: 'Box created' }),
    ].join('\n');

    assert.deepEqual(parseAgentResult(response), {
      project: expected,
      message: 'Box created',
    });
  });

  it('repairs raw newlines inside project file content and emits project tool input', () => {
    const response =
      '{"project":{"schemaVersion":1,"entrypointPath":"main.scad","files":[' +
      '{"path":"main.scad","content":"include <lib/support.scad>;\nsupport_part();"},' +
      '{"path":"lib/support.scad","content":"module support_part() {\n  cube([30,30,30]);\n}"}' +
      ']},"message":"Klart"}';

    const parsed = parseAgentResult(response);
    assert.equal(parsed.project?.entrypointPath, 'main.scad');
    assert.deepEqual(parsed.project?.files.map((file) => file.path), [
      'lib/support.scad',
      'main.scad',
    ]);
    assert.match(parsed.project?.files[0]?.content ?? '', /cube\(\[30,30,30\]\)/);

    const parts = finishWithParametricToolCall(response, FINISH);
    assert.equal(parts[0]?.type, 'tool-call');
    if (parts[0]?.type === 'tool-call') {
      const input = JSON.parse(parts[0].input) as {
        project: OpenScadProject;
        code?: unknown;
      };
      assert.equal(input.code, undefined);
      assert.deepEqual(input.project, parsed.project);
      assert.equal(input.project.files.length, 2);
    }
  });

  it('uses a structured project result from reasoning when text is empty', () => {
    const expected = project();
    const envelope = JSON.stringify({ project: expected, message: 'Done' });
    const reasoning = `I need to keep both files.\n${envelope}`;
    const resolved = resolveAgentResultChannels('', reasoning);

    assert.equal(resolved.resultText, reasoning);
    assert.equal(resolved.reasoningText, 'I need to keep both files.');
    assert.deepEqual(parseAgentResult(resolved.resultText), {
      project: expected,
      message: 'Done',
    });
  });

  it('prefers the final project result in the text channel', () => {
    const draft = project('support_part();', 'module support_part() { cube(5); }');
    const final = project('support_part();', 'module support_part() { cube(10); }');
    const reasoningDraft = JSON.stringify({ project: draft, message: 'Draft' });
    const finalText = JSON.stringify({ project: final, message: 'Final' });
    const resolved = resolveAgentResultChannels(finalText, reasoningDraft);

    assert.equal(resolved.resultText, finalText);
    assert.equal(resolved.reasoningText, '');
    assert.deepEqual(parseAgentResult(resolved.resultText), {
      project: final,
      message: 'Final',
    });
  });

  it('selects the last complete snapshot when the agent corrects a support file', () => {
    const draft = project(undefined, 'module support_part() { cube(5); }');
    const final = project(undefined, 'module support_part() { sphere(10); }');
    const response = [
      JSON.stringify({ project: draft, message: 'Draft' }),
      'Correction:',
      JSON.stringify({ project: final, message: 'Final' }),
    ].join('\n');

    assert.deepEqual(parseStructuredAgentResult(response), {
      project: final,
      message: 'Final',
    });
  });

  it('normalizes file ordering while keeping the requested entrypoint stable', () => {
    const unsorted: OpenScadProject = {
      schemaVersion: 1,
      entrypointPath: 'src/main.scad',
      files: [
        { path: 'src/main.scad', content: 'include <../lib/a.scad>;\na();' },
        { path: 'lib/a.scad', content: 'module a() { sphere(2); }' },
      ],
    };
    const parsed = parseAgentResult(
      JSON.stringify({ project: unsorted, message: 'Updated support file' }),
    );
    assert.equal(parsed.project?.entrypointPath, 'src/main.scad');
    assert.deepEqual(parsed.project?.files.map((file) => file.path), [
      'lib/a.scad',
      'src/main.scad',
    ]);
  });

  it('does not accept the legacy top-level code artifact contract', () => {
    const response = JSON.stringify({ code: 'cube(10);', message: 'legacy' });
    const parsed = parseAgentResult(response);
    assert.equal(parsed.project, undefined);
    assert.equal(parsed.message, response);
    assert.equal(
      finishWithParametricToolCall(response, FINISH).some(
        (part) => part.type === 'tool-call',
      ),
      false,
    );
  });

  it('does not reinterpret ordinary prose as a structured project result', () => {
    const response = 'Use difference() with cube() to make a hollow box.';
    assert.equal(parseStructuredAgentResult(response), undefined);
    assert.deepEqual(parseAgentResult(response), { message: response });
  });
});
''')

print('Step 5 project-native tests codemod applied')
