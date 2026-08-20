import assert from 'node:assert/strict';
import { afterEach, describe, it, vi } from 'vitest';
import {
  buildOpenCodePromptBody,
  buildOpenCodeSessionIdentity,
  updateOpenCodeSessionTitle,
} from '../src/server/opencode';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenCode pCAD session identity', () => {
  it('keeps the selected model while choosing the project-local pCAD agent', () => {
    const prompt = [
      'System: CAD context',
      'User: Create a parametric box',
      'Assistant: Done',
      'User: Make the lid 2 mm thicker',
    ].join('\n\n');

    const identity = buildOpenCodeSessionIdentity(
      'llama-swap/qwen3.6-35b-mtp-128k',
      prompt,
    );
    assert.deepEqual(identity, {
      title: '[pCAD] qwen3.6-35b-mtp-128k · Make the lid 2 mm thicker',
      agent: 'pcad-builder',
      model: {
        providerID: 'llama-swap',
        id: 'qwen3.6-35b-mtp-128k',
      },
    });
    assert.deepEqual(buildOpenCodePromptBody('Build it'), {
      prompt: { text: 'Build it' },
      resume: true,
    });
  });

  it('updates the created session title before prompting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    assert.equal(
      await updateOpenCodeSessionTitle(
        'http://127.0.0.1:4096',
        'session-123',
        '[pCAD] big-pickle · Create a box',
      ),
      true,
    );
    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    assert.equal(url, 'http://127.0.0.1:4096/api/session/session-123');
    assert.equal(init.method, 'PATCH');
    assert.deepEqual(JSON.parse(String(init.body)), {
      title: '[pCAD] big-pickle · Create a box',
    });
  });
});
