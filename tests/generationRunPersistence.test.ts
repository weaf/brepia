import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { Database } from '../shared/database';
import {
  generationRunFailureFields,
  generationRunInsertFor,
  generationRunKindForConversation,
  generationRunRowToSnapshot,
  generationRunUpdateFor,
} from '../src/server/generationRunPersistence';

type GenerationRunRow = Database['public']['Tables']['generation_runs']['Row'];

const row: GenerationRunRow = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: '00000000-0000-0000-0000-000000000002',
  conversation_id: '00000000-0000-0000-0000-000000000003',
  request_message_id: '00000000-0000-0000-0000-000000000004',
  response_message_id: '00000000-0000-0000-0000-000000000005',
  kind: 'brep',
  requested_model_id: 'agent/opencode/local/test',
  actual_model_id: 'local/test',
  transport_kind: 'opencode',
  execution_mode: 'streaming',
  status: 'running',
  phase: 'generating',
  detail: 'Streaming from OpenCode.',
  sequence: 4,
  created_at: '2026-09-08T03:00:00.000Z',
  started_at: '2026-09-08T03:00:01.000Z',
  updated_at: '2026-09-08T03:00:02.000Z',
  completed_at: null,
  error_code: null,
  error_message: null,
};

describe('generation run persistence mapping', () => {
  it('creates the minimal server-owned queued row', () => {
    const now = '2026-09-08T03:00:00.000Z';
    assert.deepEqual(
      generationRunInsertFor(
        {
          userId: row.user_id,
          conversationId: row.conversation_id,
          requestMessageId: row.request_message_id,
          kind: 'brep',
          requestedModelId: row.requested_model_id,
        },
        now,
      ),
      {
        user_id: row.user_id,
        conversation_id: row.conversation_id,
        request_message_id: row.request_message_id,
        kind: 'brep',
        requested_model_id: row.requested_model_id,
        status: 'queued',
        phase: 'request_saved',
        sequence: 1,
        created_at: now,
        updated_at: now,
      },
    );
  });

  it('round-trips durable mutable state without changing identity fields', () => {
    const snapshot = generationRunRowToSnapshot(row);
    assert.equal(snapshot.id, row.id);
    assert.equal(snapshot.kind, 'brep');
    assert.equal(snapshot.transportKind, 'opencode');
    assert.equal(snapshot.executionMode, 'streaming');
    assert.equal(snapshot.sequence, 4);

    assert.deepEqual(generationRunUpdateFor(snapshot), {
      response_message_id: row.response_message_id,
      actual_model_id: row.actual_model_id,
      transport_kind: row.transport_kind,
      execution_mode: row.execution_mode,
      status: row.status,
      phase: row.phase,
      detail: row.detail,
      sequence: row.sequence,
      started_at: row.started_at,
      updated_at: row.updated_at,
      completed_at: null,
      error_code: null,
      error_message: null,
    });
  });

  it('derives BRep creation and follow-up runs from the explicit BRep route', () => {
    assert.equal(generationRunKindForConversation('parametric', false), 'parametric');
    assert.equal(generationRunKindForConversation('parametric', true), 'brep');
    assert.equal(generationRunKindForConversation('creative', true), 'creative');
  });

  it('builds deterministic bounded failure terminal fields', () => {
    const now = '2026-09-08T03:05:00.000Z';
    assert.deepEqual(generationRunFailureFields('model_call_failed', now), {
      status: 'failed',
      completedAt: now,
      errorCode: 'model_call_failed',
    });
  });
});
