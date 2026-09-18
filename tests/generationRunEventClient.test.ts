import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import type { GenerationRunEventSnapshot } from '../shared/generationRunEvent';
import {
  generationRunEventRowToClientSnapshot,
  reconcileGenerationRunEvents,
  shouldPollGenerationRunEvents,
} from '../src/services/generationRunService';
import type { GenerationRunSnapshot } from '../shared/generationRun';

const serviceSource = fs.readFileSync(
  new URL('../src/services/generationRunService.ts', import.meta.url),
  'utf8',
);

function event(
  sequence: number,
  overrides: Partial<GenerationRunEventSnapshot> = {},
): GenerationRunEventSnapshot {
  return {
    id: `event-${sequence}`,
    generationRunId: 'run-1',
    userId: 'user-1',
    sequence,
    kind: 'model_step',
    modelStepNumber: sequence,
    createdAt: `2026-09-16T05:20:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides,
  };
}

function run(
  overrides: Partial<GenerationRunSnapshot> = {},
): GenerationRunSnapshot {
  return {
    id: 'run-1',
    userId: 'user-1',
    conversationId: 'conversation-1',
    requestMessageId: 'request-1',
    kind: 'brep',
    requestedModelId: 'local/qwen',
    status: 'running',
    phase: 'generating',
    sequence: 2,
    createdAt: '2026-09-16T05:20:00.000Z',
    updatedAt: '2026-09-16T05:20:01.000Z',
    ...overrides,
  };
}

describe('client durable generation telemetry', () => {
  it('maps the RLS-visible event row into the shared snapshot contract', () => {
    assert.deepEqual(
      generationRunEventRowToClientSnapshot({
        id: 'event-7',
        generation_run_id: 'run-1',
        user_id: 'user-1',
        sequence: 7,
        kind: 'canonical_candidate_rejected',
        invocation_number: null,
        candidate_number: 2,
        build_attempt_number: null,
        model_step_number: null,
        repair_count: null,
        error_code: 'graph_integrity',
        error_message: 'Disconnected canonical graph.',
        context_used_tokens: null,
        context_limit_tokens: null,
        created_at: '2026-09-16T05:20:07.000Z',
      }),
      {
        id: 'event-7',
        generationRunId: 'run-1',
        userId: 'user-1',
        sequence: 7,
        kind: 'canonical_candidate_rejected',
        candidateNumber: 2,
        errorCode: 'graph_integrity',
        errorMessage: 'Disconnected canonical graph.',
        createdAt: '2026-09-16T05:20:07.000Z',
      },
    );
  });

  it('reconciles reload/poll results deterministically without duplicates or foreign-run events', () => {
    const current = [event(3), event(4)];
    const incoming = [
      event(2),
      event(4, { id: 'event-4-reloaded' }),
      event(5),
      event(6, { generationRunId: 'run-other' }),
    ];

    const reconciled = reconcileGenerationRunEvents(current, incoming, 'run-1');
    assert.deepEqual(
      reconciled.map(({ sequence, id }) => [sequence, id]),
      [
        [2, 'event-2'],
        [3, 'event-3'],
        [4, 'event-4-reloaded'],
        [5, 'event-5'],
      ],
    );
  });

  it('polls telemetry only while its durable parent run is non-terminal', () => {
    assert.equal(shouldPollGenerationRunEvents(undefined), false);
    assert.equal(shouldPollGenerationRunEvents(run()), true);
    assert.equal(
      shouldPollGenerationRunEvents(
        run({ status: 'completed', phase: 'preview_ready' }),
      ),
      false,
    );
    assert.equal(
      shouldPollGenerationRunEvents(
        run({ status: 'failed', errorCode: 'model_stream_failed' }),
      ),
      false,
    );
  });

  it('loads the durable ledger through the existing browser Supabase/RLS service path', () => {
    assert.match(serviceSource, /\.from\('generation_run_events'\)/);
    assert.match(serviceSource, /\.eq\('generation_run_id', generationRunId\)/);
    assert.match(serviceSource, /\.order\('sequence', \{ ascending: true \}\)/);
    assert.match(serviceSource, /refetchOnWindowFocus: 'always'/);
    assert.match(serviceSource, /useGenerationRunEvents/);
    assert.doesNotMatch(serviceSource, /insert\([\s\S]*generation_run_events/);
  });
});
