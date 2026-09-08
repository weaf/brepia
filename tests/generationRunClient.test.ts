import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { Database } from '../shared/database';
import type { GenerationRunSnapshot } from '../shared/generationRun';
import {
  durableBrepProgressSteps,
  generationRunModelLabel,
} from '../src/lib/brepGenerationProgress';
import {
  generationRunRowToClientSnapshot,
  shouldPollGenerationRun,
} from '../src/services/generationRunService';

type GenerationRunRow = Database['public']['Tables']['generation_runs']['Row'];

const row: GenerationRunRow = {
  id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
  conversation_id: '00000000-0000-4000-8000-000000000003',
  request_message_id: '00000000-0000-4000-8000-000000000004',
  response_message_id: null,
  kind: 'brep',
  requested_model_id: 'agent/opencode/local/qwen',
  actual_model_id: 'local/qwen',
  transport_kind: 'opencode',
  execution_mode: 'streaming',
  status: 'running',
  phase: 'generating',
  detail: 'Model generation in progress.',
  sequence: 3,
  created_at: '2026-09-08T04:00:00.000Z',
  started_at: '2026-09-08T04:00:01.000Z',
  updated_at: '2026-09-08T04:00:02.000Z',
  completed_at: null,
  error_code: null,
  error_message: null,
};

function run(
  overrides: Partial<GenerationRunSnapshot> = {},
): GenerationRunSnapshot {
  return {
    ...generationRunRowToClientSnapshot(row),
    ...overrides,
  };
}

describe('client durable generation status', () => {
  it('maps the RLS-visible row into the shared immutable snapshot contract', () => {
    const snapshot = generationRunRowToClientSnapshot(row);
    assert.equal(snapshot.kind, 'brep');
    assert.equal(snapshot.actualModelId, 'local/qwen');
    assert.equal(snapshot.transportKind, 'opencode');
    assert.equal(snapshot.executionMode, 'streaming');
    assert.equal(snapshot.sequence, 3);
  });

  it('polls only while a run is non-terminal, plus the short missing-row handoff', () => {
    assert.equal(shouldPollGenerationRun(undefined, false), false);
    assert.equal(shouldPollGenerationRun(undefined, true), true);
    assert.equal(shouldPollGenerationRun(run(), false), true);
    assert.equal(
      shouldPollGenerationRun(
        run({
          status: 'completed',
          phase: 'preview_ready',
          completedAt: '2026-09-08T04:00:10.000Z',
        }),
        true,
      ),
      false,
    );
    assert.equal(
      shouldPollGenerationRun(
        run({
          status: 'failed',
          errorCode: 'model_stream_failed',
          completedAt: '2026-09-08T04:00:10.000Z',
        }),
        true,
      ),
      false,
    );
  });

  it('drives creation steps from durable server phases', () => {
    const generating = durableBrepProgressSteps({
      run: run(),
      conversationSynced: true,
    });
    assert.equal(generating[2].state, 'complete');
    assert.equal(generating[3].state, 'active');
    assert.equal(generating[4].state, 'pending');

    const waiting = durableBrepProgressSteps({
      run: run({ status: 'waiting_for_preview', phase: 'revision_saved' }),
      conversationSynced: true,
    });
    assert.equal(waiting[5].state, 'complete');
    assert.equal(waiting[6].state, 'active');

    const ready = durableBrepProgressSteps({
      run: run({
        status: 'completed',
        phase: 'preview_ready',
        completedAt: '2026-09-08T04:00:10.000Z',
      }),
      conversationSynced: true,
    });
    assert.ok(ready.every((step) => step.state === 'complete'));
  });

  it('pins a terminal failure to the durable phase instead of showing a spinner', () => {
    const steps = durableBrepProgressSteps({
      run: run({
        status: 'failed',
        phase: 'saving_revision',
        errorCode: 'response_persistence_failed',
        completedAt: '2026-09-08T04:00:10.000Z',
      }),
      conversationSynced: true,
    });
    assert.equal(steps[5].state, 'failed');
    assert.equal(steps[6].state, 'pending');
  });

  it('shows immutable actual transport/model provenance when durable state exists', () => {
    assert.equal(
      generationRunModelLabel(run(), 'openai/gpt-5.6-sol', 'cli'),
      'OpenCode streaming · local/qwen',
    );
  });
});
