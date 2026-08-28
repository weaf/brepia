import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  isTerminalAssistantMessage,
  persistedCompletionCoversLiveTurn,
} from '../src/hooks/chatCompletionReconciliation';

describe('chat completion reconciliation', () => {
  it('does not treat a normal resolved build by itself as terminal', () => {
    assert.equal(
      isTerminalAssistantMessage({
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      }),
      false,
    );
  });

  it('treats an imported synthetic build baseline as terminal', () => {
    assert.equal(
      isTerminalAssistantMessage({
        id: 'assistant-import',
        role: 'assistant',
        metadata: { artifactOrigin: { type: 'import' } },
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      }),
      true,
    );
  });

  it('does not treat an unresolved imported tool as terminal', () => {
    assert.equal(
      isTerminalAssistantMessage({
        id: 'assistant-import',
        role: 'assistant',
        metadata: { artifactOrigin: { type: 'import' } },
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'input-available',
          },
        ],
      }),
      false,
    );
  });

  it('treats resolved answer_user after a build as terminal', () => {
    assert.equal(
      isTerminalAssistantMessage({
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
          {
            type: 'tool-answer_user',
            state: 'output-available',
          },
        ],
      }),
      true,
    );
  });

  it('treats completed adapter text after the last build as terminal', () => {
    assert.equal(
      isTerminalAssistantMessage({
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
          { type: 'text', state: 'done', text: 'Done.' },
        ],
      }),
      true,
    );
  });

  it('does not reconcile an older terminal assistant over a new live user turn', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', state: 'done', text: 'Done' }],
      },
      { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'Second' }] },
    ];
    const persisted = live.slice(0, 2);

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), false);
  });

  it('reconciles a persisted terminal assistant that completes the current live user turn', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
      { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'Second' }] },
    ];
    const persisted = [
      ...live,
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
          {
            type: 'tool-answer_user',
            state: 'output-available',
          },
        ],
      },
    ];

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), true);
  });

  it('reconciles when the same live assistant id becomes terminal in persistence', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      },
    ];
    const persisted = [
      live[0],
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
          { type: 'text', state: 'done', text: 'Finished' },
        ],
      },
    ];

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), true);
  });

  it('reconciles a later terminal assistant in the same auto-continuation chain', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Create' }] },
      {
        id: 'assistant-build',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      },
    ];
    const persisted = [
      ...live,
      {
        id: 'assistant-final',
        role: 'assistant',
        parts: [
          {
            type: 'tool-answer_user',
            state: 'output-available',
          },
        ],
      },
    ];

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), true);
  });

  it('reconciles from the persisted user anchor when the local assistant id never persisted', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Create' }] },
      {
        id: 'assistant-local-only',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'input-streaming',
          },
        ],
      },
    ];
    const persisted = [
      live[0],
      {
        id: 'assistant-persisted-build',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      },
      {
        id: 'assistant-final',
        role: 'assistant',
        parts: [
          {
            type: 'tool-answer_user',
            state: 'output-available',
          },
        ],
      },
    ];

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), true);
  });

  it('does not use a persisted user anchor across a newer user turn', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Create' }] },
      {
        id: 'assistant-local-only',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'input-streaming',
          },
        ],
      },
    ];
    const persisted = [
      live[0],
      {
        id: 'assistant-persisted-build',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      },
      { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'Change it' }] },
      {
        id: 'assistant-final',
        role: 'assistant',
        parts: [{ type: 'text', state: 'done', text: 'Changed.' }],
      },
    ];

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), false);
  });

  it('does not reconcile through a newer user turn after the live assistant', () => {
    const live = [
      { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Create' }] },
      {
        id: 'assistant-old',
        role: 'assistant',
        parts: [
          {
            type: 'tool-build_parametric_model',
            state: 'output-available',
          },
        ],
      },
    ];
    const persisted = [
      ...live,
      { id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'Change it' }] },
      {
        id: 'assistant-new',
        role: 'assistant',
        parts: [{ type: 'text', state: 'done', text: 'Changed.' }],
      },
    ];

    assert.equal(persistedCompletionCoversLiveTurn(live, persisted), false);
  });
});
