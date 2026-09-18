import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { afterEach, describe, it, vi } from 'vitest';
import { buildCliAgentArgs } from '../src/server/cliAgents';
import {
  buildOpenCodeSessionId,
  buildOpenCodeSessionIdentity,
  ensureOpenCodeSession,
} from '../src/server/opencode';
import { openCodeAgentForSourceKind } from '../src/server/opencodeAgentRouting';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Native BRep OpenCode agent routing', () => {
  it('selects the source-specific agent without changing the selected model', () => {
    const model = 'llama-swap/qwen3.6-35b-mtp-128k';
    const prompt = '\n\nUser: Build a cabinet';

    assert.equal(openCodeAgentForSourceKind('openscad'), 'pcad-builder');
    assert.equal(openCodeAgentForSourceKind('brep'), 'brep-builder');

    const openScadIdentity = buildOpenCodeSessionIdentity(
      model,
      prompt,
      'openscad',
    );
    const brepIdentity = buildOpenCodeSessionIdentity(model, prompt, 'brep');

    assert.equal(openScadIdentity.agent, 'pcad-builder');
    assert.equal(brepIdentity.agent, 'brep-builder');
    assert.deepEqual(brepIdentity.model, openScadIdentity.model);
    assert.deepEqual(brepIdentity.model, {
      providerID: 'llama-swap',
      id: 'qwen3.6-35b-mtp-128k',
    });

    assert.deepEqual(
      buildCliAgentArgs('opencode', model, 'ses_brep', 'brep'),
      [
        'run',
        '--format',
        'json',
        '--agent',
        'brep-builder',
        '-m',
        model,
        '--session',
        'ses_brep',
      ],
    );
    assert.deepEqual(
      buildCliAgentArgs('opencode', model, 'ses_scad', 'openscad'),
      [
        'run',
        '--format',
        'json',
        '--agent',
        'pcad-builder',
        '-m',
        model,
        '--session',
        'ses_scad',
      ],
    );
  });

  it('keeps the Native BRep agent least-privilege and denies OpenSCAD validation', async () => {
    const agent = await readFile(
      new URL('../.opencode/agents/brep-builder.md', import.meta.url),
      'utf8',
    );

    for (const permission of [
      'read',
      'edit',
      'bash',
      'webfetch',
      'websearch',
      'task',
      'pcad_validate',
    ]) {
      assert.match(agent, new RegExp(`\\n  ${permission}: deny(?:\\n|$)`));
    }
    assert.doesNotMatch(agent, /pcad_validate:\s*allow/);
  });

  it('switches an existing persistent session to brep-builder in place without changing its model', async () => {
    const conversationId = '123e4567-e89b-12d3-a456-426614174000';
    const sessionId = buildOpenCodeSessionId(conversationId);
    const model = {
      providerID: 'llama-swap',
      id: 'qwen3.6-35b-mtp-128k',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: sessionId,
              agent: 'pcad-builder',
              model,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const identity = buildOpenCodeSessionIdentity(
      `${model.providerID}/${model.id}`,
      '\n\nUser: Continue the cabinet',
      'brep',
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
      `http://127.0.0.1:4096/api/session/${sessionId}/agent`,
    );
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    assert.deepEqual(JSON.parse(String(init.body)), {
      agent: 'brep-builder',
    });
  });
});
