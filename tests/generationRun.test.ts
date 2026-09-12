import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  applyGenerationRunTransition,
  GenerationRunTransitionError,
  isGenerationRunAiEditing,
  isGenerationRunTerminal,
  type GenerationRunSnapshot,
} from '../shared/generationRun';

const initialRun = (): GenerationRunSnapshot => ({
  id: 'run-1',
  userId: 'user-1',
  conversationId: 'conversation-1',
  requestMessageId: 'message-1',
  kind: 'brep',
  requestedModelId: 'agent/opencode/llama-swap/qwen3.8-27b',
  status: 'queued',
  phase: 'request_saved',
  sequence: 1,
  createdAt: '2026-09-07T20:00:00.000Z',
  updatedAt: '2026-09-07T20:00:00.000Z',
});

function expectTransitionError(
  callback: () => unknown,
  code: GenerationRunTransitionError['code'],
) {
  assert.throws(callback, (error: unknown) => {
    assert.ok(error instanceof GenerationRunTransitionError);
    assert.equal(error.code, code);
    return true;
  });
}

describe('durable generation run transitions', () => {
  it('uses sequence as a monotonic state version and rejects stale writes', () => {
    const running = applyGenerationRunTransition(initialRun(), {
      sequence: 2,
      status: 'running',
      phase: 'model_dispatched',
      actualModelId: 'llama-swap/qwen3.8-27b',
      transportKind: 'opencode',
      executionMode: 'streaming',
      startedAt: '2026-09-07T20:00:01.000Z',
      updatedAt: '2026-09-07T20:00:01.000Z',
    });

    assert.equal(running.sequence, 2);
    assert.equal(running.phase, 'model_dispatched');
    assert.equal(running.transportKind, 'opencode');

    expectTransitionError(
      () =>
        applyGenerationRunTransition(running, {
          sequence: 2,
          phase: 'generating',
          updatedAt: '2026-09-07T20:00:02.000Z',
        }),
      'invalid_sequence',
    );
  });

  it('allows reconnect detail updates without fabricating forward progress', () => {
    const generating = applyGenerationRunTransition(initialRun(), {
      sequence: 2,
      status: 'running',
      phase: 'generating',
      updatedAt: '2026-09-07T20:00:02.000Z',
    });
    const reconnect = applyGenerationRunTransition(generating, {
      sequence: 3,
      phase: 'generating',
      detail: 'OpenCode event stream reconnected',
      updatedAt: '2026-09-07T20:00:05.000Z',
    });

    assert.equal(reconnect.phase, 'generating');
    assert.equal(reconnect.detail, 'OpenCode event stream reconnected');
    assert.equal(reconnect.sequence, 3);
  });

  it('rejects phase regression even when the sequence is newer', () => {
    const response = applyGenerationRunTransition(initialRun(), {
      sequence: 2,
      status: 'running',
      phase: 'response_received',
      updatedAt: '2026-09-07T20:00:10.000Z',
    });

    expectTransitionError(
      () =>
        applyGenerationRunTransition(response, {
          sequence: 3,
          phase: 'generating',
          updatedAt: '2026-09-07T20:00:11.000Z',
        }),
      'phase_regression',
    );
  });

  it('models the current BRep boundary as waiting for preview, not a fake queue', () => {
    const generating = applyGenerationRunTransition(initialRun(), {
      sequence: 2,
      status: 'running',
      phase: 'generating',
      updatedAt: '2026-09-07T20:00:02.000Z',
    });
    const sourceReady = applyGenerationRunTransition(generating, {
      sequence: 3,
      status: 'waiting_for_preview',
      phase: 'revision_saved',
      responseMessageId: 'assistant-1',
      updatedAt: '2026-09-07T20:00:10.000Z',
    });
    const evaluation = applyGenerationRunTransition(sourceReady, {
      sequence: 4,
      status: 'running',
      phase: 'evaluation_requested',
      updatedAt: '2026-09-07T20:00:20.000Z',
    });
    const ready = applyGenerationRunTransition(evaluation, {
      sequence: 5,
      status: 'completed',
      phase: 'preview_ready',
      updatedAt: '2026-09-07T20:00:30.000Z',
      completedAt: '2026-09-07T20:00:30.000Z',
    });

    assert.equal(sourceReady.status, 'waiting_for_preview');
    assert.equal(evaluation.phase, 'evaluation_requested');
    assert.equal(ready.status, 'completed');
    assert.ok(isGenerationRunTerminal(ready.status));
  });

  it('locks source editing only while AI generation can still mutate source', () => {
    const activePhases: GenerationRunSnapshot['phase'][] = [
      'request_saved',
      'model_dispatched',
      'generating',
      'response_received',
      'validating_artifact',
      'saving_revision',
    ];
    for (const phase of activePhases) {
      assert.equal(
        isGenerationRunAiEditing({ status: 'running', phase }),
        true,
        phase,
      );
    }

    const previewPhases: GenerationRunSnapshot['phase'][] = [
      'revision_saved',
      'evaluation_requested',
      'evaluating_native',
      'preparing_viewer',
      'preview_ready',
    ];
    for (const phase of previewPhases) {
      assert.equal(
        isGenerationRunAiEditing({ status: 'running', phase }),
        false,
        phase,
      );
    }

    assert.equal(
      isGenerationRunAiEditing({ status: 'failed', phase: 'saving_revision' }),
      false,
    );
    assert.equal(
      isGenerationRunAiEditing({ status: 'cancelled', phase: 'generating' }),
      false,
    );
  });

  it('requires bounded terminal failure metadata and freezes terminal runs', () => {
    expectTransitionError(
      () =>
        applyGenerationRunTransition(initialRun(), {
          sequence: 2,
          status: 'failed',
          updatedAt: '2026-09-07T20:00:05.000Z',
          completedAt: '2026-09-07T20:00:05.000Z',
        }),
      'invalid_terminal_fields',
    );

    const failed = applyGenerationRunTransition(initialRun(), {
      sequence: 2,
      status: 'failed',
      errorCode: 'provider_unavailable',
      errorMessage: 'The configured provider is unavailable.',
      updatedAt: '2026-09-07T20:00:05.000Z',
      completedAt: '2026-09-07T20:00:05.000Z',
    });

    assert.equal(failed.errorCode, 'provider_unavailable');
    assert.ok(isGenerationRunTerminal(failed.status));
    expectTransitionError(
      () =>
        applyGenerationRunTransition(failed, {
          sequence: 3,
          status: 'running',
          updatedAt: '2026-09-07T20:00:06.000Z',
        }),
      'terminal_run',
    );
  });
});
