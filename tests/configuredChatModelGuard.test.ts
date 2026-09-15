import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildSelectableCatalog: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock('../src/server/modelCatalog', () => ({
  buildSelectableCatalog: mocks.buildSelectableCatalog,
}));

vi.mock('../src/server/api', () => ({
  isRecord: (value: unknown) => typeof value === 'object' && value !== null,
  isUnauthorizedError: (error: unknown) =>
    error instanceof Error && error.message === 'Unauthorized',
  json: (data: unknown, status = 200) => Response.json(data, { status }),
  requireUser: mocks.requireUser,
}));

import { withConfiguredChatModel } from '../src/server/configuredChatModelGuard';

const USER = { id: '00000000-0000-4000-8000-000000000001' };

function request(body: unknown) {
  return new Request('http://localhost/api/parametric-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('withConfiguredChatModel', () => {
  beforeEach(() => {
    mocks.buildSelectableCatalog.mockReset();
    mocks.requireUser.mockReset();
    mocks.requireUser.mockResolvedValue(USER);
  });

  it('passes cancellation through without requiring a model', async () => {
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withConfiguredChatModel(
      request({ action: 'cancel', conversationId: 'conv-1' }),
      'parametric',
      handler,
    );

    expect(response.status).toBe(204);
    expect(handler).toHaveBeenCalledOnce();
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });

  it('rejects a Parametric model that is not selectable in Settings', async () => {
    mocks.buildSelectableCatalog.mockResolvedValue([
      { id: 'local/configured-model' },
    ]);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withConfiguredChatModel(
      request({ conversationId: 'conv-1', model: '__unconfigured__' }),
      'parametric',
      handler,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'model_not_configured',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('passes a model that is selectable in Settings', async () => {
    mocks.buildSelectableCatalog.mockResolvedValue([
      { id: 'local/configured-model' },
    ]);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withConfiguredChatModel(
      request({ conversationId: 'conv-1', model: 'local/configured-model' }),
      'parametric',
      handler,
    );

    expect(response.status).toBe(204);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('rejects an explicitly requested Creative agent that is stale', async () => {
    mocks.buildSelectableCatalog.mockResolvedValue([
      { id: 'local/configured-model' },
    ]);
    const handler = vi.fn(async () => new Response(null, { status: 204 }));

    const response = await withConfiguredChatModel(
      request({
        conversationId: 'conv-1',
        model: 'local/native',
        agentModel: 'openrouter/not-in-settings',
      }),
      'creative',
      handler,
    );

    expect(response.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
  });
});
