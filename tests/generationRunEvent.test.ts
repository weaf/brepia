import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  GENERATION_RUN_EVENT_ERROR_MESSAGE_MAX_LENGTH,
  GENERATION_RUN_EVENT_MAX_COUNT,
  GenerationRunEventContractError,
  normalizeGenerationRunEventInput,
} from '../shared/generationRunEvent';

describe('generation run event contract', () => {
  it('normalizes bounded structured rejection diagnostics', () => {
    assert.deepEqual(
      normalizeGenerationRunEventInput({
        kind: 'canonical_candidate_rejected',
        candidateNumber: 2,
        errorCode: ' graph_integrity ',
        errorMessage: ' Disconnected canonical graph. ',
      }),
      {
        kind: 'canonical_candidate_rejected',
        candidateNumber: 2,
        errorCode: 'graph_integrity',
        errorMessage: 'Disconnected canonical graph.',
      },
    );
  });

  it('requires the event-specific counter needed for deterministic progress', () => {
    assert.throws(
      () => normalizeGenerationRunEventInput({ kind: 'build_rejected' }),
      (error: unknown) => {
        assert.ok(error instanceof GenerationRunEventContractError);
        assert.equal(error.code, 'missing_required_counter');
        return true;
      },
    );
  });

  it('rejects diagnostics beyond the durable UI-safe bound', () => {
    assert.throws(
      () =>
        normalizeGenerationRunEventInput({
          kind: 'canonical_candidate_rejected',
          candidateNumber: 1,
          errorMessage: 'x'.repeat(
            GENERATION_RUN_EVENT_ERROR_MESSAGE_MAX_LENGTH + 1,
          ),
        }),
      (error: unknown) => {
        assert.ok(error instanceof GenerationRunEventContractError);
        assert.equal(error.code, 'field_too_long');
        return true;
      },
    );
  });

  it('accepts zero current context usage while requiring a positive limit', () => {
    assert.deepEqual(
      normalizeGenerationRunEventInput({
        kind: 'context_usage',
        contextUsedTokens: 0,
        contextLimitTokens: 131072,
      }),
      {
        kind: 'context_usage',
        contextUsedTokens: 0,
        contextLimitTokens: 131072,
      },
    );

    assert.throws(() =>
      normalizeGenerationRunEventInput({
        kind: 'context_usage',
        contextUsedTokens: 1,
        contextLimitTokens: 0,
      }),
    );
  });

  it('keeps the durable ledger explicitly bounded', () => {
    assert.equal(GENERATION_RUN_EVENT_MAX_COUNT, 128);
  });
});
