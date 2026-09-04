import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildAgentOutputContract,
  finishWithParametricToolCall,
  parseAgentResult,
  parseStructuredAgentResult,
  resolveAgentResultChannels,
} from '../src/server/opencodeAgentResult';
import type { OpenScadProject } from '@shared/openScadProject';
import { phaseOneCabinetProject } from '@shared/brepSamples';

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
    assert.deepEqual(
      parsed.project?.files.map((file) => file.path),
      ['lib/support.scad', 'main.scad'],
    );
    assert.match(
      parsed.project?.files[0]?.content ?? '',
      /cube\(\[30,30,30\]\)/,
    );

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
    const draft = project(
      'support_part();',
      'module support_part() { cube(5); }',
    );
    const final = project(
      'support_part();',
      'module support_part() { cube(10); }',
    );
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
    assert.deepEqual(
      parsed.project?.files.map((file) => file.path),
      ['lib/a.scad', 'src/main.scad'],
    );
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

describe('native BRep external-agent result parsing', () => {
  const revisedBrep = {
    ...phaseOneCabinetProject,
    nodes: phaseOneCabinetProject.nodes.map((node) =>
      node.id === 'cableHole' && node.type === 'cylinder'
        ? { ...node, radius: 60 }
        : node,
    ),
  };

  it('keeps the legacy OpenSCAD output contract as the default', () => {
    const contract = buildAgentOutputContract();
    assert.match(contract, /OpenSCAD project snapshot/);
    assert.match(contract, /build_parametric_model/);
    assert.doesNotMatch(contract, /build_brep_project/);
  });

  it('provides a bounded native BRep output contract', () => {
    const contract = buildAgentOutputContract('brep');
    assert.match(contract, /complete canonical BRep project snapshot/i);
    assert.match(contract, /Preserve the existing project id/);
    assert.match(contract, /build_brep_project/);
    assert.match(contract, /Never return build123d\/Python source/);
    assert.doesNotMatch(contract, /build_parametric_model/);
  });

  it('normalizes a complete BRep snapshot through the shared BRep normalizer', () => {
    const response = JSON.stringify({
      project: revisedBrep,
      message: 'Cable hole enlarged',
    });
    const parsed = parseAgentResult(response, 'brep');

    assert.equal(parsed.project?.id, phaseOneCabinetProject.id);
    assert.equal(
      parsed.project?.nodes.find((node) => node.id === 'cableHole')?.type,
      'cylinder',
    );
    assert.equal(
      parsed.project?.nodes.find(
        (node) => node.id === 'cableHole' && node.type === 'cylinder',
      )?.radius,
      60,
    );
  });

  it('fails closed on an invalid BRep snapshot instead of interpreting it as OpenSCAD', () => {
    const invalid = {
      ...revisedBrep,
      resultNodeId: 'missingNode',
    };
    const parsed = parseAgentResult(
      JSON.stringify({ project: invalid, message: 'Broken candidate' }),
      'brep',
    );

    assert.equal(parsed.project, undefined);
    assert.equal(parsed.message, 'Broken candidate');
  });

  it('emits build_brep_project for a validated BRep result', () => {
    const response = JSON.stringify({
      project: revisedBrep,
      message: 'Cable hole enlarged',
    });
    const parts = finishWithParametricToolCall(response, FINISH, 'brep');

    assert.equal(parts[0]?.type, 'tool-call');
    if (parts[0]?.type === 'tool-call') {
      assert.equal(parts[0].toolName, 'build_brep_project');
      const input = JSON.parse(parts[0].input) as {
        title: string;
        version: string;
        project: typeof revisedBrep;
        message?: string;
      };
      assert.equal(input.title, revisedBrep.name);
      assert.equal(input.version, 'v1');
      assert.equal(input.project.id, phaseOneCabinetProject.id);
      assert.equal(input.message, undefined);
    }
    const lastPart = parts.at(-1);
    assert.equal(lastPart?.type, 'finish');
    if (lastPart?.type === 'finish') {
      assert.equal(lastPart.finishReason.unified, 'tool-calls');
    }
  });
});
