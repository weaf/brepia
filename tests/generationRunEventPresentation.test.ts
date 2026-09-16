import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { GenerationRunEventSnapshot } from '../shared/generationRunEvent';
import { generationRunEventLabel } from '../src/lib/generationRunEventPresentation';

function event(
  kind: GenerationRunEventSnapshot['kind'],
  overrides: Partial<GenerationRunEventSnapshot> = {},
): GenerationRunEventSnapshot {
  return {
    id: 'event-1',
    generationRunId: 'run-1',
    userId: 'user-1',
    sequence: 1,
    kind,
    createdAt: '2026-09-16T06:00:00.000Z',
    ...overrides,
  } as GenerationRunEventSnapshot;
}

describe('generation run event presentation', () => {
  it('renders canonical candidate acceptance and rejection as concise human-readable activity', () => {
    assert.equal(
      generationRunEventLabel(
        event('canonical_candidate_rejected', {
          candidateNumber: 1,
          errorCode: 'graph_integrity',
          errorMessage: 'Disconnected canonical graph.',
        }),
      ),
      'Candidate 1 rejected — graph integrity',
    );
    assert.equal(
      generationRunEventLabel(
        event('canonical_candidate_accepted', { candidateNumber: 2 }),
      ),
      'Candidate 2 accepted',
    );
  });

  it('renders repair and build outcomes without exposing hidden reasoning', () => {
    assert.equal(
      generationRunEventLabel(
        event('transport_repair', { repairCount: 1 }),
      ),
      'Repairing candidate · repair 1',
    );
    assert.equal(
      generationRunEventLabel(
        event('build_attempt_started', { buildAttemptNumber: 1 }),
      ),
      'Validating build',
    );
    assert.equal(
      generationRunEventLabel(
        event('build_rejected', {
          buildAttemptNumber: 1,
          errorCode: 'disconnected_union',
        }),
      ),
      'Build rejected — disconnected union',
    );
    assert.equal(
      generationRunEventLabel(
        event('build_accepted', { buildAttemptNumber: 2 }),
      ),
      'Build accepted',
    );
  });

  it('renders model and context telemetry with bounded structured fields only', () => {
    assert.equal(
      generationRunEventLabel(event('model_step', { modelStepNumber: 4 })),
      'Model step 4',
    );
    assert.equal(
      generationRunEventLabel(
        event('context_usage', {
          contextUsedTokens: 12_000,
          contextLimitTokens: 32_768,
        }),
      ),
      'Context usage 12,000 / 32,768 tokens',
    );
  });
});
