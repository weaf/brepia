import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DANGLING_TOOL_ERROR_TEXT,
  decidePersistAction,
  hasPendingClientToolCall,
  hasPersistableMessageParts,
  isDanglingToolPart,
  resolveDanglingToolParts,
} from './chatToolPersistence.ts';

describe('hasPersistableMessageParts', () => {
  it('rejects an empty provider response before DB persistence', () => {
    assert.equal(hasPersistableMessageParts([]), false);
  });

  it('accepts any non-empty assistant payload', () => {
    assert.equal(hasPersistableMessageParts([{ type: 'text', text: 'ok' }]), true);
    assert.equal(
      hasPersistableMessageParts([
        { type: 'tool-build_parametric_model', state: 'input-available' },
      ]),
      true,
    );
  });
});

describe('isDanglingToolPart', () => {
  it('flags tool calls awaiting a result', () => {
    assert.equal(
      isDanglingToolPart({
        type: 'tool-answer_user',
        state: 'input-available',
      }),
      true,
    );
    assert.equal(
      isDanglingToolPart({
        type: 'tool-build_parametric_model',
        state: 'input-streaming',
      }),
      true,
    );
    assert.equal(
      isDanglingToolPart({ type: 'dynamic-tool', state: 'input-available' }),
      true,
    );
  });

  it('leaves resolved tool calls alone', () => {
    assert.equal(
      isDanglingToolPart({
        type: 'tool-build_parametric_model',
        state: 'output-available',
      }),
      false,
    );
    assert.equal(
      isDanglingToolPart({ type: 'tool-answer_user', state: 'output-error' }),
      false,
    );
  });

  it('ignores non-tool parts', () => {
    assert.equal(
      isDanglingToolPart({ type: 'text', state: 'streaming' }),
      false,
    );
    assert.equal(isDanglingToolPart({ type: 'reasoning' }), false);
    assert.equal(isDanglingToolPart({ type: 'step-start' }), false);
  });
});

describe('resolveDanglingToolParts', () => {
  it('rewrites only dangling tool calls to output-error and preserves the rest', () => {
    const parts = [
      { type: 'text', text: 'hi', state: 'done' },
      {
        type: 'tool-build_parametric_model',
        state: 'output-available',
        foo: 1,
      },
      { type: 'tool-answer_user', state: 'input-available', toolCallId: 'abc' },
    ];

    const result = resolveDanglingToolParts(parts);

    assert.equal(result[0], parts[0]);
    assert.equal(result[1], parts[1]);
    assert.deepEqual(result[2], {
      type: 'tool-answer_user',
      state: 'output-error',
      toolCallId: 'abc',
      errorText: DANGLING_TOOL_ERROR_TEXT,
    });
  });

  it('is a no-op when nothing dangles', () => {
    const parts = [
      { type: 'tool-build_parametric_model', state: 'output-available' },
      { type: 'tool-answer_user', state: 'output-available' },
    ];
    const result = resolveDanglingToolParts(parts);
    assert.deepEqual(result, parts);
  });
});

describe('hasPendingClientToolCall', () => {
  it('detects a terminal pending tool call', () => {
    assert.equal(
      hasPendingClientToolCall([
        { type: 'tool-build_parametric_model', state: 'output-available' },
        { type: 'tool-answer_user', state: 'input-available' },
      ]),
      true,
    );
  });

  it('is false once everything is resolved', () => {
    assert.equal(
      hasPendingClientToolCall([
        { type: 'tool-build_parametric_model', state: 'output-available' },
        { type: 'tool-answer_user', state: 'output-available' },
      ]),
      false,
    );
  });

  it('is false for pure-text turns', () => {
    assert.equal(
      hasPendingClientToolCall([{ type: 'text', state: 'done' }]),
      false,
    );
  });

  it('treats a pending dynamic-tool as client-owned (symmetric with isDanglingToolPart)', () => {
    assert.equal(
      hasPendingClientToolCall([
        { type: 'dynamic-tool', state: 'input-available' },
      ]),
      true,
    );
    assert.equal(
      isDanglingToolPart({ type: 'dynamic-tool', state: 'input-available' }),
      true,
    );
  });
});

describe('decidePersistAction — the clobber guard', () => {
  it('inserts a fresh assistant row (leaf was a user message)', () => {
    assert.equal(
      decidePersistAction({ isContinuation: false, hasPendingToolCall: true }),
      'insert',
    );
    assert.equal(
      decidePersistAction({ isContinuation: false, hasPendingToolCall: false }),
      'insert',
    );
  });

  it('skips the terminal answer_user continuation (the actual bug)', () => {
    assert.equal(
      decidePersistAction({ isContinuation: true, hasPendingToolCall: true }),
      'skip',
    );
  });

  it('updates a continuation once everything is resolved / pure text', () => {
    assert.equal(
      decidePersistAction({ isContinuation: true, hasPendingToolCall: false }),
      'update',
    );
  });
});

describe('end-to-end: a normal first turn never persists a dangling tool call', () => {
  it('insert(build pending) → skip(answer_user pending), so the row never gets clobbered', () => {
    const buildPending = [
      { type: 'tool-build_parametric_model', state: 'input-available' },
    ];
    assert.equal(
      decidePersistAction({
        isContinuation: false,
        hasPendingToolCall: hasPendingClientToolCall(buildPending),
      }),
      'insert',
      'first build turn must create the row',
    );

    const answerPending = [
      { type: 'tool-build_parametric_model', state: 'output-available' },
      { type: 'tool-answer_user', state: 'input-available' },
    ];
    assert.equal(
      decidePersistAction({
        isContinuation: true,
        hasPendingToolCall: hasPendingClientToolCall(answerPending),
      }),
      'skip',
      'terminal answer_user turn must defer to the client',
    );

    const persistedByClient = [
      { type: 'tool-build_parametric_model', state: 'output-available' },
      { type: 'tool-answer_user', state: 'output-available' },
    ];
    assert.deepEqual(
      resolveDanglingToolParts(persistedByClient),
      persistedByClient,
      'a healthy branch passes through the sanitizer untouched',
    );
  });
});
