import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  appendGenerationRunEvent,
  generationRunEventRowToSnapshot,
  generationRunEventRpcArgsFor,
  listGenerationRunEvents,
} from '../src/server/generationRunEventPersistence';

const row = {
  id: '00000000-0000-4000-8000-000000000101',
  generation_run_id: '00000000-0000-4000-8000-000000000001',
  user_id: '00000000-0000-4000-8000-000000000002',
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
  created_at: '2026-09-16T05:15:00.000Z',
};

describe('generation run event persistence', () => {
  it('maps database rows into the shared durable event contract', () => {
    assert.deepEqual(generationRunEventRowToSnapshot(row), {
      id: row.id,
      generationRunId: row.generation_run_id,
      userId: row.user_id,
      sequence: 7,
      kind: 'canonical_candidate_rejected',
      candidateNumber: 2,
      errorCode: 'graph_integrity',
      errorMessage: 'Disconnected canonical graph.',
      createdAt: row.created_at,
    });
  });

  it('builds a narrow RPC payload with no arbitrary provider payload field', () => {
    assert.deepEqual(
      generationRunEventRpcArgsFor(row.generation_run_id, row.user_id, {
        kind: 'build_rejected',
        buildAttemptNumber: 3,
        errorCode: 'disconnected_union',
        errorMessage: 'Build must resolve to exactly one solid.',
      }),
      {
        p_generation_run_id: row.generation_run_id,
        p_user_id: row.user_id,
        p_kind: 'build_rejected',
        p_invocation_number: null,
        p_candidate_number: null,
        p_build_attempt_number: 3,
        p_model_step_number: null,
        p_repair_count: null,
        p_error_code: 'disconnected_union',
        p_error_message: 'Build must resolve to exactly one solid.',
        p_context_used_tokens: null,
        p_context_limit_tokens: null,
      },
    );
  });

  it('appends through the database-owned sequence boundary', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      async rpc(name: string, args: unknown) {
        calls.push({ name, args });
        return { data: [row], error: null };
      },
    };

    const event = await appendGenerationRunEvent(
      row.generation_run_id,
      row.user_id,
      {
        kind: 'canonical_candidate_rejected',
        candidateNumber: 2,
        errorCode: row.error_code,
        errorMessage: row.error_message,
      },
      { client: client as never },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'append_generation_run_event');
    assert.equal(event.sequence, 7);
    assert.equal(event.candidateNumber, 2);
  });

  it('loads only the requested owner/run in deterministic sequence order', async () => {
    const filters: Array<[string, string]> = [];
    const orders: Array<[string, boolean]> = [];
    const query = {
      select(selection: string) {
        assert.equal(selection, '*');
        return this;
      },
      eq(field: string, value: string) {
        filters.push([field, value]);
        return this;
      },
      async order(field: string, options: { ascending: boolean }) {
        orders.push([field, options.ascending]);
        return { data: [row], error: null };
      },
    };
    const client = {
      from(table: string) {
        assert.equal(table, 'generation_run_events');
        return query;
      },
    };

    const events = await listGenerationRunEvents(
      row.generation_run_id,
      row.user_id,
      { client: client as never },
    );

    assert.deepEqual(filters, [
      ['generation_run_id', row.generation_run_id],
      ['user_id', row.user_id],
    ]);
    assert.deepEqual(orders, [['sequence', true]]);
    assert.deepEqual(events.map((event) => event.sequence), [7]);
  });
});
