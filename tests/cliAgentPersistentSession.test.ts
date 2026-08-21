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
} from '../src/server/cliAgents';

describe('persistent CLI agent sessions', () => {
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
            input: JSON.stringify({ title: 'Box', version: 'v1', code: 'cube([10,10,10]);' }),
          },
          {
            type: 'tool-call',
            toolCallId: codexToolCallId,
            toolName: 'build_parametric_model',
            input: JSON.stringify({ title: 'Box', version: 'v1', code: 'cube([10,10,10]);' }),
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
          JSON.stringify({ type: 'text', part: { type: 'text', text: '{"code":"cube();","message":"done"}' } }),
          JSON.stringify({ type: 'session.complete', sessionID: 'ses_resume_me' }),
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
          JSON.stringify({ type: 'thread.started', thread_id: '019d1c0a-0137-73f3-bf4a-88c90739150c' }),
          JSON.stringify({
            type: 'item.completed',
            item: { type: 'agent_message', text: '{"code":"cube();","message":"done"}' },
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
      { role: 'assistant', content: [{ type: 'text', text: 'Old assistant prose that should not be replayed' }] },
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
              code: 'width = 20;\ncube([width, 20, 10]);',
            }),
          },
        ],
      },
      { role: 'user', content: [{ type: 'text', text: 'Make it 30 mm wide' }] },
    ] as unknown as LanguageModelV3Prompt;

    const text = buildPersistentCliAgentPrompt(prompt, true);
    assert.match(text, /<current_pcad_artifact>/);
    assert.match(text, /width = 20;/);
    assert.match(text, /<user_request>\nMake it 30 mm wide\n<\/user_request>/);
    assert.doesNotMatch(text, /Old assistant prose/);
    assert.doesNotMatch(text, /CAD system context/);
  });
});
