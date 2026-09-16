import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import type { GenerationRunSnapshot } from '../shared/generationRun';
import {
  GENERATION_RUN_EVENT_TERMINAL_SETTLE_MS,
  reconcileGenerationRunEvents,
  shouldPollGenerationRunEvents,
} from '../src/services/generationRunService';

const serviceSource = fs.readFileSync(
  new URL('../src/services/generationRunService.ts', import.meta.url),
  'utf8',
);

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
    sequence: 4,
    createdAt: '2026-09-16T06:00:00.000Z',
    updatedAt: '2026-09-16T06:00:05.000Z',
    ...overrides,
  };
}

describe('generation run telemetry durability reconciliation', () => {
  it('keeps a bounded terminal settle window so the final queued telemetry write can be observed', () => {
    const terminal = run({
      status: 'completed',
      phase: 'preview_ready',
      updatedAt: '2026-09-16T06:00:10.000Z',
      completedAt: '2026-09-16T06:00:10.000Z',
    });
    const terminalAt = Date.parse(terminal.updatedAt);

    assert.equal(shouldPollGenerationRunEvents(terminal, terminalAt), true);
    assert.equal(
      shouldPollGenerationRunEvents(
        terminal,
        terminalAt + GENERATION_RUN_EVENT_TERMINAL_SETTLE_MS - 1,
      ),
      true,
    );
    assert.equal(
      shouldPollGenerationRunEvents(
        terminal,
        terminalAt + GENERATION_RUN_EVENT_TERMINAL_SETTLE_MS,
      ),
      false,
    );
  });

  it('continues normal polling for active runs and does not poll without a parent run', () => {
    assert.equal(shouldPollGenerationRunEvents(run()), true);
    assert.equal(shouldPollGenerationRunEvents(undefined), false);
  });

  it('treats a legacy run with no detailed telemetry as a valid empty durable ledger', () => {
    assert.deepEqual(reconcileGenerationRunEvents([], [], 'run-legacy'), []);
  });

  it('refetches the durable ledger after reload, reconnect, and returning to the tab', () => {
    assert.match(serviceSource, /refetchOnMount: 'always'/);
    assert.match(serviceSource, /refetchOnReconnect: 'always'/);
    assert.match(serviceSource, /refetchOnWindowFocus: 'always'/);
    assert.match(serviceSource, /refetchIntervalInBackground: true/);
  });
});
