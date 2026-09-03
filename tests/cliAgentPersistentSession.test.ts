import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import {
  buildCliAgentArgs,
  buildPersistentCliAgentPrompt,
  cliAgentSessionIdFromPrompt,
  encodeCliAgentSessionToolCallId,
  parseCodexCliOutput,
  parseOpenCodeCliOutput,
  selectChatTransport,
} from '../src/server/cliAgents';
import { phaseOneCabinetProject } from '../shared/brepSamples';

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

describe('persistent CLI agent sessions', () => {
  it('routes Codex agent models through the CLI adapter in either OpenCode execution mode', () => {
    assert.deepEqual(selectChatTransport('agent/codex/default', 'cli'), {
      kind: 'cli-agent',
    });
    assert.deepEqual(selectChatTransport('agent/codex/default', 'streaming'), {
      kind: 'cli-agent',
    });
  });

  it('persists and recovers OpenCode and Codex session IDs through tool-call IDs', () => {
    const openCodeId = 'ses_abc123XYZ';
    const codexId = '019d1c0a-0137-73f3-bf4a-88c90739150c';
    const openCodeToolCallId = encodeCliAgentSessionToolCallId(
      'opencode',
      openCodeId,
    );
    const codexToolCallId = encodeCliAgentSessionToolCallId('codex', codexId);

    const prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: openCodeToolCallId,
            toolName: 'build_parametric_model',
            input: JSON.stringify({
              title: 'Box',
              version: 'v1',
              project: project('cube([10,10,10]);'),
            }),
          },
          {
            type: 'tool-call',
            toolCallId: codexToolCallId,
            toolName: 'build_parametric_model',
            input: JSON.stringify({
              title: 'Box',
              version: 'v1',
              project: project('cube([10,10,10]);'),
            }),
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    assert.equal(cliAgentSessionIdFromPrompt('opencode', prompt), openCodeId);
    assert.equal(cliAgentSessionIdFromPrompt('codex', prompt), codexId);
  });

  it('uses native resume syntax, the pCAD OpenCode agent, and non-ephemeral Codex sessions', () => {
    const openCodeArgs = buildCliAgentArgs(
      'opencode',
      'llama-swap/qwen3.6-35b-mtp-128k',
      'ses_123',
    );
    assert.deepEqual(openCodeArgs, [
      'run',
      '--format',
      'json',
      '--agent',
      'pcad-builder',
      '-m',
      'llama-swap/qwen3.6-35b-mtp-128k',
      '--session',
      'ses_123',
    ]);
    assert.equal(openCodeArgs.includes('--pure'), false);

    const codexArgs = buildCliAgentArgs(
      'codex',
      'gpt-5.6-sol',
      '019d1c0a-0137-73f3-bf4a-88c90739150c',
    );
    assert.deepEqual(codexArgs, [
      'exec',
      'resume',
      '019d1c0a-0137-73f3-bf4a-88c90739150c',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--json',
      '-m',
      'gpt-5.6-sol',
      '-',
    ]);
    assert.equal(codexArgs.includes('--ephemeral'), false);
  });

  it('extracts the resumable session IDs emitted by both CLIs', () => {
    assert.deepEqual(
      parseOpenCodeCliOutput(
        [
          JSON.stringify({
            type: 'text',
            part: { type: 'text', text: '{"code":"cube();","message":"done"}' },
          }),
          JSON.stringify({
            type: 'session.complete',
            sessionID: 'ses_resume_me',
          }),
        ].join('\n'),
      ),
      {
        text: '{"code":"cube();","message":"done"}',
        sessionId: 'ses_resume_me',
      },
    );

    assert.deepEqual(
      parseCodexCliOutput(
        [
          JSON.stringify({
            type: 'thread.started',
            thread_id: '019d1c0a-0137-73f3-bf4a-88c90739150c',
          }),
          JSON.stringify({
            type: 'item.completed',
            item: {
              type: 'agent_message',
              text: '{"code":"cube();","message":"done"}',
            },
          }),
        ].join('\n'),
      ),
      {
        text: '{"code":"cube();","message":"done"}',
        sessionId: '019d1c0a-0137-73f3-bf4a-88c90739150c',
      },
    );
  });

  it('sends the current pCAD artifact instead of replaying the whole chat history', () => {
    const prompt = [
      { role: 'system', content: 'CAD system context' },
      { role: 'user', content: [{ type: 'text', text: 'Create a box' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Old assistant prose that should not be replayed',
          },
        ],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool-1',
            toolName: 'build_parametric_model',
            input: JSON.stringify({
              title: 'Box',
              version: 'v1',
              project: project('width = 20;\ncube([width, 20, 10]);'),
            }),
          },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'Make it 30 mm wide' }] },
    ] as unknown as LanguageModelV3Prompt;

    const text = buildPersistentCliAgentPrompt(prompt, true);
    assert.match(text, /<current_pcad_artifact>/);
    assert.match(text, /width = 20;/);
    assert.match(text, /lib\/support\.scad/);
    assert.match(text, /module support_part/);
    assert.match(text, /"entrypointPath":"main.scad"/);
    assert.doesNotMatch(text, /<current_pcad_artifact>\n<openscad>/);
    assert.match(text, /<user_request>\nMake it 30 mm wide\n<\/user_request>/);
    assert.doesNotMatch(text, /Old assistant prose/);
    assert.doesNotMatch(text, /CAD system context/);
  });

  it('sends the exact current BRep project on every BRep continuation without OpenSCAD artifacts', () => {
    const prompt = [
      { role: 'system', content: 'BRep system context' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Increase the cable hole' }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'brep-call',
            toolName: 'build_brep_project',
            output: { type: 'text', value: 'Native BRep revision accepted.' },
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const text = buildPersistentCliAgentPrompt(prompt, true, '', {
      sourceKind: 'brep',
      currentBrepProject: phaseOneCabinetProject,
    });

    assert.match(text, /<current_brep_project>/);
    assert.match(text, new RegExp(`"id":"${phaseOneCabinetProject.id}"`));
    assert.match(text, /Native BRep revision accepted/);
    assert.doesNotMatch(text, /current_pcad_artifact/);
  });

  it('keeps the same OpenCode CLI session and latest artifact through a fourth edit', () => {
    const sessionId = 'ses_four_turns';
    const codes = [
      'revision = 1;\ncube([10,10,10]);',
      'revision = 2;\ncube([20,10,10]);',
      'revision = 3;\ncube([20,20,10]);',
      'revision = 4;\ncube([20,20,20]);',
    ];
    const build = (turn: number) => ({
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: encodeCliAgentSessionToolCallId('opencode', sessionId),
          toolName: 'build_parametric_model',
          input: {
            title: 'Box',
            version: 'v1',
            project: project(codes[turn - 1]),
          },
        },
      ],
    });
    const result = (turn: number, toolCallId: string) => ({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId,
          toolName: 'build_parametric_model',
          output: { type: 'text', value: `turn ${turn} compiled` },
        },
      ],
    });

    const build1 = build(1);
    const build2 = build(2);
    const build3 = build(3);
    const prompt = [
      { role: 'system', content: 'CAD system context' },
      { role: 'user', content: [{ type: 'text', text: 'Turn 1: make a box' }] },
      build1,
      result(1, (build1.content[0] as { toolCallId: string }).toolCallId),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Turn 2: make it wider' }],
      },
      build2,
      result(2, (build2.content[0] as { toolCallId: string }).toolCallId),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Turn 3: make it deeper' }],
      },
      build3,
      result(3, (build3.content[0] as { toolCallId: string }).toolCallId),
      {
        role: 'user',
        content: [{ type: 'text', text: 'Turn 4: make it taller' }],
      },
    ] as unknown as LanguageModelV3Prompt;

    assert.equal(cliAgentSessionIdFromPrompt('opencode', prompt), sessionId);

    const fourthTurn = buildPersistentCliAgentPrompt(prompt, true);
    assert.match(fourthTurn, /revision = 3;/);
    assert.doesNotMatch(fourthTurn, /revision = 1;/);
    assert.doesNotMatch(fourthTurn, /revision = 2;/);
    assert.match(
      fourthTurn,
      /<user_request>\nTurn 4: make it taller\n<\/user_request>/,
    );

    const build4 = build(4);
    const continuation = [
      ...prompt,
      build4,
      result(4, (build4.content[0] as { toolCallId: string }).toolCallId),
    ] as unknown as LanguageModelV3Prompt;

    assert.equal(
      cliAgentSessionIdFromPrompt('opencode', continuation),
      sessionId,
    );
    const fourthContinuation = buildPersistentCliAgentPrompt(
      continuation,
      true,
    );
    assert.match(fourthContinuation, /revision = 4;/);
    assert.match(fourthContinuation, /turn 4 compiled/);
    assert.match(
      fourthContinuation,
      /<task_context>\nTurn 4: make it taller\n<\/task_context>/,
    );
  });
});
