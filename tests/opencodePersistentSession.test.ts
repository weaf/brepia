import assert from 'node:assert/strict';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { afterEach, describe, it, vi } from 'vitest';
import {
  buildOpenCodeSessionId,
  buildOpenCodeSessionIdentity,
  buildPersistentOpenCodePrompt,
  ensureOpenCodeSession,
} from '../src/server/opencode';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent OpenCode sessions', () => {
  it('derives one stable session id from a pCAD conversation', () => {
    assert.equal(
      buildOpenCodeSessionId('123e4567-e89b-12d3-a456-426614174000'),
      'ses_pcad_123e4567e89b12d3a456426614174000',
    );
  });

  it('sends the current OpenSCAD artifact and build feedback on continuation', () => {
    const prompt = [
      { role: 'system', content: 'CAD context' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Make the lid thicker' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'build_parametric_model',
            input: JSON.stringify({
              title: 'Box',
              version: 'v1',
              code: 'width = 40;\nheight = 20;\ncube([width, width, height]);',
            }),
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'build_parametric_model',
            output: { type: 'text', value: 'Compiled successfully.' },
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    const reused = buildPersistentOpenCodePrompt(prompt, false);
    assert.match(reused, /<current_pcad_artifact>/);
    assert.match(reused, /width = 40;/);
    assert.match(reused, /Compiled successfully/);
    assert.equal(reused.includes('<user_request>'), false);

    const recreated = buildPersistentOpenCodePrompt(prompt, true);
    assert.match(recreated, /<user_request>\s*Make the lid thicker/);
  });

  it('switches model in place instead of creating another session', async () => {
    const conversationId = '123e4567-e89b-12d3-a456-426614174000';
    const sessionId = buildOpenCodeSessionId(conversationId);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: sessionId,
              agent: 'pcad-builder',
              model: {
                providerID: 'llama-swap',
                id: 'qwen3.6-35b-mtp-128k',
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const identity = buildOpenCodeSessionIdentity(
      'opencode/big-pickle',
      '\n\nUser: Improve the existing box',
    );
    const result = await ensureOpenCodeSession(
      'http://127.0.0.1:4096',
      identity,
      conversationId,
      new AbortController().signal,
    );

    assert.equal(result.sessionId, sessionId);
    assert.equal(result.created, false);
    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(
      fetchMock.mock.calls[1]?.[0],
      `http://127.0.0.1:4096/api/session/${sessionId}/model`,
    );
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    assert.deepEqual(JSON.parse(String(init.body)), {
      model: { providerID: 'opencode', id: 'big-pickle' },
    });
  });
});
