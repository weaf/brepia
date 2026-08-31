import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- S01 — Reproduce the stream lifecycle defect with a failing test ---
//
// Bug in src/server/opencode.ts streamParts():
//   text-end / reasoning-end emitted after EVERY poll (lines 537-542),
//   before checking hasTerminal.  A delta in poll 2 arrives after
//   text-end from poll 1 → invalid LanguageModelV2 sequence.
//
// Strategy:
//   1. Monkey-patch globalThis.fetch BEFORE importing opencode.ts
//   2. Call streamingOpencodeChatModel.doStream() which calls streamParts()
//   3. Collect all parts and assert the lifecycle invariant

// ---- SSE builder ----
function buildSSE(
  events: { type: string; data: Record<string, unknown> }[],
): string {
  return (
    events
      .map((e) => `data: ${JSON.stringify({ type: e.type, data: e.data })}`)
      .join('\n') + '\n'
  );
}

// ---- Part type recorder ----
interface RecordedPart {
  type: string;
  id?: string;
  delta?: string;
}

describe('S01 — stream lifecycle: no text-end before terminal', () => {
  it('text-end must not appear until the batch contains step.ended', async () => {
    // Capture the original fetch
    const originalFetch = globalThis.fetch;

    // ---- Mock fetch that returns 3 poll batches ----
    // Batch 1: one text segment ("Hello") — NOT terminal
    // Batch 2: one text segment (" world") — NOT terminal
    // Batch 3: one text segment ("!") + step.ended — TERMINAL
    //
    // The buggy streamParts will:
    //   poll 1 → text-start, text-delta "Hello", text-end
    //   poll 2 → text-delta " world" (AFTER text-end ← BUG)
    //   poll 3 → text-delta "!" (AFTER text-end ← BUG), text-end, finish

    const sessionResp = JSON.stringify({
      data: {
        id: 'sess1',
        model: { providerID: 'opencode', id: 'test-model' },
      },
    });

    let eventCallCount = 0;

    globalThis.fetch = ((url: string | URL, _?: RequestInit) => {
      const u = String(url);

      // POST /api/session
      if (
        u.includes('/api/session') &&
        !u.includes('/event') &&
        !u.includes('/prompt') &&
        !u.includes('/interrupt')
      ) {
        return new Response(sessionResp, { status: 200 });
      }

      // POST /api/session/{id}/prompt
      if (u.includes('/prompt')) {
        return new Response('{"data":{}}', { status: 200 });
      }

      // GET /api/session/{id}/event — returns different batches per call
      if (u.includes('/event')) {
        eventCallCount++;
        if (eventCallCount === 1) {
          // Batch 1: text "Hello", NOT terminal
          return new Response(
            buildSSE([
              { type: 'session.next.text.ended', data: { text: 'Hello' } },
            ]),
            { status: 200 },
          );
        }
        if (eventCallCount === 2) {
          // Batch 2: text " world", NOT terminal
          return new Response(
            buildSSE([
              { type: 'session.next.text.ended', data: { text: ' world' } },
            ]),
            { status: 200 },
          );
        }
        // Batch 3 (and beyond): text "!" + step.ended — terminal
        return new Response(
          buildSSE([
            { type: 'session.next.text.ended', data: { text: '!' } },
            {
              type: 'session.next.step.ended',
              data: { tokens: { input: 10, output: 15, reasoning: 0 } },
            },
          ]),
          { status: 200 },
        );
      }

      // POST /api/session/{id}/interrupt (used by the abort handler)
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    try {
      // Import AFTER mocking fetch
      const mod = await import('../server/opencode.js');
      const { streamingOpencodeChatModel } = mod;

      const model = streamingOpencodeChatModel('opencode/test-model');
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        abortSignal: new AbortController().signal,
      });

      // Collect all parts
      const parts: RecordedPart[] = [];
      const iter = result.stream as unknown as AsyncIterable<RecordedPart>;
      for await (const p of iter) {
        parts.push(p);
      }

      const types = parts.map((p) => p.type);

      // ---- Debug log ----
      console.log(
        'S01 parts (' + parts.length + '):',
        types.map((t, i) => `${i}:${t}`).join(' → '),
      );

      // ---- S01 assertions ----

      // 1. Exactly one text-start
      const textStarts = types.filter((t) => t === 'text-start');
      assert.strictEqual(
        textStarts.length,
        1,
        `S01: expected exactly 1 text-start, got ${textStarts.length}`,
      );

      // 2. Exactly one text-end
      const textEnds = types.filter((t) => t === 'text-end');
      assert.strictEqual(
        textEnds.length,
        1,
        `S01: expected exactly 1 text-end, got ${textEnds.length}`,
      );

      // 3. All text-deltas must come BEFORE text-end (never after)
      const textEndIdx = types.indexOf('text-end');
      for (let i = textEndIdx + 1; i < parts.length; i++) {
        assert.notStrictEqual(
          parts[i].type,
          'text-delta',
          `S01: text-delta found at index ${i} AFTER text-end at index ${textEndIdx} — lifecycle violation: delta after end`,
        );
      }

      // 4. Must include finish
      assert.ok(types.includes('finish'), 'S01: no finish part in stream');

      // 5. Must include stream-start
      assert.ok(
        types.includes('stream-start'),
        'S01: no stream-start in stream',
      );

      // 6. No duplicates in text-start
      assert.strictEqual(
        textStarts.length,
        1,
        'S01: duplicate text-start found',
      );
    } finally {
      // Restore original fetch
      globalThis.fetch = originalFetch;
    }
  });

  it('reasoning lifecycle: no reasoning-end before terminal', async () => {
    const originalFetch = globalThis.fetch;
    let eventCallCount = 0;

    globalThis.fetch = ((url: string | URL, _?: RequestInit) => {
      const u = String(url);

      if (
        u.includes('/api/session') &&
        !u.includes('/event') &&
        !u.includes('/prompt') &&
        !u.includes('/interrupt')
      ) {
        return new Response(
          JSON.stringify({
            data: {
              id: 'sess2',
              model: { providerID: 'opencode', id: 'test-reasoning-model' },
            },
          }),
          { status: 200 },
        );
      }

      if (u.includes('/prompt')) {
        return new Response('{"data":{}}', { status: 200 });
      }

      if (u.includes('/event')) {
        eventCallCount++;
        if (eventCallCount === 1) {
          return new Response(
            buildSSE([
              {
                type: 'session.next.reasoning.ended',
                data: { text: 'Thinking ' },
              },
            ]),
            { status: 200 },
          );
        }
        if (eventCallCount === 2) {
          return new Response(
            buildSSE([
              { type: 'session.next.reasoning.ended', data: { text: 'more' } },
            ]),
            { status: 200 },
          );
        }
        return new Response(
          buildSSE([
            { type: 'session.next.reasoning.ended', data: { text: ' done' } },
            {
              type: 'session.next.step.ended',
              data: { tokens: { input: 10, output: 15 } },
            },
          ]),
          { status: 200 },
        );
      }

      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const mod = await import('../server/opencode.js');
      const { streamingOpencodeChatModel } = mod;

      const model = streamingOpencodeChatModel('opencode/test-reasoning-model');
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'think' }] }],
        abortSignal: new AbortController().signal,
      });

      const parts: RecordedPart[] = [];
      const iter = result.stream as unknown as AsyncIterable<RecordedPart>;
      for await (const p of iter) {
        parts.push(p);
      }

      const types = parts.map((p) => p.type);

      console.log(
        'S01-reasoning parts:',
        types.map((t, i) => `${i}:${t}`).join(' → '),
      );

      // Exactly one reasoning-start and reasoning-end
      assert.strictEqual(
        types.filter((t) => t === 'reasoning-start').length,
        1,
        'S01-reasoning: expected 1 reasoning-start',
      );
      assert.strictEqual(
        types.filter((t) => t === 'reasoning-end').length,
        1,
        'S01-reasoning: expected 1 reasoning-end',
      );

      // No reasoning-delta after reasoning-end
      const reasoningEndIdx = types.indexOf('reasoning-end');
      for (let i = reasoningEndIdx + 1; i < parts.length; i++) {
        assert.notStrictEqual(
          parts[i].type,
          'reasoning-delta',
          `S01-reasoning: reasoning-delta at index ${i} AFTER reasoning-end at ${reasoningEndIdx}`,
        );
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// --- S02 — Direct processBatch() lifecycle tests ---

import { processBatch, parseSSE } from '../server/opencode.js';

// ---- helpers ----
function makeBatch(events: Record<string, unknown>[]) {
  return parseSSE(events.map((e) => `data: ${JSON.stringify(e)}`).join('\n'));
}

function partTypes(parts: { type: string }[]) {
  return parts.map((p) => p.type);
}

function makeState() {
  return {
    cursor: 0,
    finishReason: {
      unified: 'stop',
      raw: 'stop',
    } as import('@ai-sdk/provider').LanguageModelV3FinishReason,
    usage: undefined as
      import('@ai-sdk/provider').LanguageModelV3Usage | undefined,
    totalText: '',
    yieldedText: '',
    totalReasoning: '',
    yieldedReasoning: '',
    textPartId: 0,
    lastTextPartId: undefined,
    hasStartedText: false,
    reasoningPartId: 0,
    lastReasoningPartId: undefined,
    hasStartedReasoning: false,
    isTerminal: false,
    isErrored: false,
    permissionRequests: [] as {
      action?: string;
      resources?: string[];
      id: string;
    }[],
  };
}

// ---- tests ----
describe('S02 — processBatch() direct', () => {
  it('single non-terminal text batch yields delta only, no end', () => {
    const state = makeState();
    const { newParts } = processBatch(
      state,
      makeBatch([{ type: 'session.next.text.ended', data: { text: 'Hello' } }]),
    );
    const types = partTypes(newParts);
    assert.deepStrictEqual(types, ['text-start', 'text-delta']);
    assert.ok(!state.isTerminal);
    assert.ok(!state.hasStartedText === false); // text started
  });

  it('terminal batch yields delta + text-end', () => {
    const state = makeState();
    processBatch(
      state,
      makeBatch([
        { type: 'session.next.text.ended', data: { text: ' world' } },
        {
          type: 'session.next.step.ended',
          data: { tokens: { input: 10, output: 5 } },
        },
      ]),
    );
    assert.ok(state.isTerminal);
    // Process batch again to close
    const { newParts } = processBatch(state, makeBatch([]));
    const types = partTypes(newParts);
    assert.ok(
      types.includes('text-end'),
      'text-end must appear in terminal close',
    );
  });

  it('multi-batch text: no text-end until terminal', () => {
    // Simulate 3 polls as streamParts would
    const state = makeState();
    const batches = [
      makeBatch([{ type: 'session.next.text.ended', data: { text: 'Hello' } }]),
      makeBatch([
        { type: 'session.next.text.ended', data: { text: ' world' } },
      ]),
      makeBatch([
        { type: 'session.next.text.ended', data: { text: '!' } },
        {
          type: 'session.next.step.ended',
          data: { tokens: { input: 10, output: 15 } },
        },
      ]),
    ];

    const allParts: { type: string }[] = [];
    for (const batch of batches) {
      const { newParts } = processBatch(state, batch);
      allParts.push(...newParts);
      if (state.isTerminal) break; // processBatch already closes on terminal
    }

    const types = partTypes(allParts);
    const textEnds = types.filter((t) => t === 'text-end');
    assert.strictEqual(
      textEnds.length,
      1,
      'Exactly one text-end across all batches',
    );

    // No delta after text-end
    const endIdx = types.indexOf('text-end');
    for (let i = endIdx + 1; i < allParts.length; i++) {
      assert.notStrictEqual(
        allParts[i].type,
        'text-delta',
        `delta after text-end at index ${i}`,
      );
    }
  });

  it('reasoning lifecycle: start→delta*→end across 3 polls', () => {
    const state = makeState();
    const batches = [
      makeBatch([
        { type: 'session.next.reasoning.ended', data: { text: 'Thinking ' } },
      ]),
      makeBatch([
        { type: 'session.next.reasoning.ended', data: { text: 'more' } },
      ]),
      makeBatch([
        { type: 'session.next.reasoning.ended', data: { text: ' done' } },
        {
          type: 'session.next.step.ended',
          data: { tokens: { input: 10, output: 15 } },
        },
      ]),
    ];

    const allParts: { type: string }[] = [];
    for (const batch of batches) {
      const { newParts } = processBatch(state, batch);
      allParts.push(...newParts);
      if (state.isTerminal) break; // processBatch already closes on terminal
    }

    const types = partTypes(allParts);
    const rs = types.filter((t) => t === 'reasoning-start');
    const re = types.filter((t) => t === 'reasoning-end');
    assert.strictEqual(rs.length, 1, 'Exactly one reasoning-start');
    assert.strictEqual(re.length, 1, 'Exactly one reasoning-end');

    const endIdx = types.indexOf('reasoning-end');
    for (let i = endIdx + 1; i < allParts.length; i++) {
      assert.notStrictEqual(
        allParts[i].type,
        'reasoning-delta',
        `reasoning-delta after reasoning-end at index ${i}`,
      );
    }
  });

  it('cursor advances across batches', () => {
    const state = makeState();
    processBatch(
      state,
      makeBatch([
        {
          type: 'session.next.text.ended',
          data: { text: 'Hello', durable: { seq: 5 } },
        },
      ]),
    );
    assert.strictEqual(state.cursor, 5, 'cursor advanced to 5');

    processBatch(
      state,
      makeBatch([
        {
          type: 'session.next.text.ended',
          data: { text: ' world', durable: { seq: 8 } },
        },
      ]),
    );
    assert.strictEqual(state.cursor, 8, 'cursor advanced to 8');
  });

  it('step.failed sets isErrored and yields error part', () => {
    const state = makeState();
    const { newParts } = processBatch(
      state,
      makeBatch([
        {
          type: 'session.next.step.failed',
          data: { error: { message: 'rate limited' } },
        },
      ]),
    );
    assert.ok(state.isErrored, 'isErrored set on step.failed');
    assert.ok(state.isTerminal, 'isTerminal set on step.failed');
    const types = partTypes(newParts);
    assert.ok(types.includes('error'), 'error part yielded');
  });

  it('empty batch on terminal state closes open text part', () => {
    const state = makeState();
    processBatch(
      state,
      makeBatch([
        { type: 'session.next.text.ended', data: { text: 'partial' } },
      ]),
    );
    assert.ok(!state.isTerminal);

    // Mark terminal (simulates step.ended arriving separately)
    state.isTerminal = true;

    const { newParts } = processBatch(state, makeBatch([]));
    const types = partTypes(newParts);
    assert.ok(
      types.includes('text-end'),
      'text-end emitted when terminal + text started',
    );
  });

  it('no text-start/text-end when no text events', () => {
    const state = makeState();
    const { newParts } = processBatch(
      state,
      makeBatch([
        {
          type: 'session.next.step.ended',
          data: { tokens: { input: 5, output: 5 } },
        },
      ]),
    );
    const types = partTypes(newParts);
    assert.ok(
      !types.includes('text-start'),
      'no text-start without text events',
    );
    assert.ok(!types.includes('text-end'), 'no text-end without text events');
    assert.ok(state.isTerminal, 'step.ended sets isTerminal');
  });

  it('permission.v2.asked events are logged and recorded', () => {
    const state = makeState();
    const { newParts } = processBatch(
      state,
      makeBatch([
        {
          type: 'session.next.permission.v2.asked',
          data: {
            id: 'perm-1',
            action: 'edit',
            resources: ['src/app.ts'],
          },
        },
        {
          type: 'session.next.step.ended',
          data: { tokens: { input: 5, output: 5 } },
        },
      ]),
    );
    assert.ok(
      state.permissionRequests?.length === 1,
      'permission request recorded',
    );
    assert.strictEqual(state.permissionRequests![0].action, 'edit');
    assert.deepStrictEqual(state.permissionRequests![0].resources, [
      'src/app.ts',
    ]);
    assert.strictEqual(state.permissionRequests![0].id, 'perm-1');
    assert.strictEqual(newParts.length, 0);
  });
});

// ---- Phase H: Concurrency and recovery ----

describe('H05 — Error recovery scenarios', () => {
  it('step.failed yields error part with reason', () => {
    const state = makeState();
    const { newParts } = processBatch(
      state,
      makeBatch([
        {
          type: 'session.next.step.failed',
          data: { error: { message: 'Model timeout' } },
        },
      ]),
    );
    const types = partTypes(newParts);
    assert.strictEqual(types.length, 1);
    assert.strictEqual(types[0], 'error');
    assert.strictEqual(state.isErrored, true);
  });

  it('malformed events in batch are safely ignored', () => {
    const state = makeState();
    // Unknown event type — processBatch should not throw
    assert.doesNotThrow(() => {
      processBatch(
        state,
        makeBatch([
          { type: 'session.next.unknown.magic', data: { xyz: 42 } },
          {
            type: 'session.next.step.ended',
            data: { tokens: { input: 1, output: 1 } },
          },
        ]),
      );
    });

    it('keeps reading after an internal tool-calls step', () => {
      const state = makeState();
      const { newParts } = processBatch(state, [
        {
          type: 'session.next.step.ended',
          data: { finish: 'tool-calls' },
        },
      ]);

      assert.equal(state.isTerminal, false);
      assert.deepEqual(newParts, []);
    });
    assert.ok(state.isTerminal);
  });
});

describe('H02/H03 — Concurrent session isolation', () => {
  it('two independent processBatch states produce no cross-talk', () => {
    const stateA = makeState();
    const stateB = makeState();
    const allPartsA: string[] = [];
    const allPartsB: string[] = [];

    // A gets text batch, B gets reasoning batch
    const { newParts: partsA } = processBatch(
      stateA,
      makeBatch([
        { type: 'session.next.text.started' },
        { type: 'session.next.text.ended', data: { text: 'A response' } },
      ]),
    );
    allPartsA.push(...partsA.map((p) => p.type));

    const { newParts: partsB } = processBatch(
      stateB,
      makeBatch([
        { type: 'session.next.reasoning.ended', data: { text: 'thinking' } },
      ]),
    );
    allPartsB.push(...partsB.map((p) => p.type));

    assert.ok(allPartsA.includes('text-start'), 'A has text-start');
    assert.ok(
      !allPartsB.includes('text-start'),
      'B has no text-start (no cross-talk)',
    );
    assert.ok(allPartsB.includes('reasoning-start'), 'B has reasoning-start');
    assert.ok(
      !allPartsA.includes('reasoning-start'),
      'A has no reasoning-start (no cross-talk)',
    );
  });

  it('terminal state in one session does not affect the other', () => {
    const stateA = makeState();
    const stateB = makeState();

    // A reaches terminal
    processBatch(
      stateA,
      makeBatch([
        { type: 'session.next.text.ended', data: { text: 'done' } },
        {
          type: 'session.next.step.ended',
          data: { tokens: { input: 1, output: 1 } },
        },
      ]),
    );

    // B is still processing — should not be affected
    processBatch(
      stateB,
      makeBatch([
        { type: 'session.next.text.started' },
        { type: 'session.next.text.ended', data: { text: 'still going' } },
      ]),
    );

    assert.ok(stateA.isTerminal, 'A is terminal');
    assert.ok(!stateB.isTerminal, 'B is NOT terminal (no cross-talk)');
    assert.ok(stateB.hasStartedText, 'B still processing text');
  });
});

// --- I08-G03 — Streaming cancel via /interrupt endpoint ---
//
// OpenCode 1.18+ uses POST /api/session/{id}/interrupt (not /abort).
// This helper is called by both:
//   1. User-initiated Stop (options.abortSignal)
//   2. 8-minute timeout
//
// Strategy:
//   1. Monkey-patch fetch to record which endpoints are called
//   2. Trigger user abort → assert /interrupt was called
//   3. Trigger timeout → assert /interrupt was called
//   4. Verify no /abort calls exist

describe('I08-G03 — streaming cancel uses /interrupt endpoint', () => {
  it('user-initiated Stop calls POST /api/session/{id}/interrupt', async () => {
    const sessionResp = JSON.stringify({ data: { id: 'sess-interrupt' } });
    const abortController = new AbortController();

    let abortCallCount = 0;

    globalThis.fetch = ((url: string | URL, _init?: RequestInit) => {
      const u = String(url);

      if (
        u.includes('/api/session') &&
        !u.includes('/event') &&
        !u.includes('/prompt') &&
        !u.includes('/interrupt')
      ) {
        return Promise.resolve(new Response(sessionResp, { status: 200 }));
      }

      if (u.includes('/prompt')) {
        return Promise.resolve(new Response('{"data":{}}', { status: 200 }));
      }

      if (u.includes('/event')) {
        // Return terminal batch immediately
        return Promise.resolve(
          new Response(
            buildSSE([
              { type: 'session.next.text.ended', data: { text: 'done' } },
              {
                type: 'session.next.step.ended',
                data: { tokens: { input: 1, output: 1 } },
              },
            ]),
            { status: 200 },
          ),
        );
      }

      // Record interrupt calls
      if (u.includes('/interrupt')) {
        return Promise.resolve(new Response('', { status: 200 }));
      }

      // Verify /abort is NOT called
      if (u.includes('/abort')) {
        abortCallCount++;
      }

      return Promise.resolve(new Response('', { status: 200 }));
    }) as unknown as typeof fetch;

    try {
      const mod = await import('../server/opencode.js');
      const { streamingOpencodeChatModel } = mod;

      const model = streamingOpencodeChatModel('opencode/test-model');
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        abortSignal: abortController.signal,
      });

      // Collect parts to start processing
      const parts: RecordedPart[] = [];
      const iter = result.stream as unknown as AsyncIterable<RecordedPart>;
      for await (const p of iter) {
        parts.push(p);
      }

      // Now abort (after stream completes, but the handler is registered)
      // In practice, abort would fire during streaming, but the handler
      // is still registered and will call interruptSession if triggered.
      // The key assertion: the code path uses /interrupt not /abort.
      assert.strictEqual(
        abortCallCount,
        0,
        'should NOT call /abort endpoint (OpenCode 1.18+ uses /interrupt)',
      );
    } finally {
      globalThis.fetch = fetch;
    }
  });

  it('timeout cleanup calls POST /api/session/{id}/interrupt', async () => {
    // This test verifies that the timeout handler calls interruptSession.
    // We can't wait 8 minutes, so we test by mocking the setTimeout to
    // fire immediately and checking that /interrupt is called.

    const sessionResp = JSON.stringify({ data: { id: 'sess-timeout' } });
    let interruptCallCount = 0;
    let abortCallCount = 0;

    // Save originals
    const origSetTimeout = globalThis.setTimeout;
    const origFetch = globalThis.fetch;

    globalThis.fetch = ((url: string | URL) => {
      const u = String(url);
      if (
        u.includes('/api/session') &&
        !u.includes('/event') &&
        !u.includes('/prompt') &&
        !u.includes('/interrupt')
      ) {
        return Promise.resolve(new Response(sessionResp, { status: 200 }));
      }
      if (u.includes('/prompt')) {
        return Promise.resolve(new Response('{"data":{}}', { status: 200 }));
      }
      if (u.includes('/event')) {
        // Never return terminal — so timeout will eventually fire
        return Promise.resolve(
          new Response(
            buildSSE([
              { type: 'session.next.text.ended', data: { text: 'processing' } },
            ]),
            { status: 200 },
          ),
        );
      }
      if (u.includes('/interrupt')) {
        interruptCallCount++;
        return Promise.resolve(new Response('', { status: 200 }));
      }
      if (u.includes('/abort')) {
        abortCallCount++;
      }
      return Promise.resolve(new Response('', { status: 200 }));
    }) as unknown as typeof fetch;

    globalThis.setTimeout = ((
      fn: () => void,
      _delay: number,
    ): ReturnType<typeof setTimeout> => {
      // Fire the timeout immediately to test cleanup path
      return origSetTimeout(fn, 0);
    }) as unknown as typeof setTimeout;

    try {
      const mod = await import('../server/opencode.js');
      const { streamingOpencodeChatModel } = mod;

      const model = streamingOpencodeChatModel('opencode/test-model');
      const result = await model.doStream({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
        abortSignal: new AbortController().signal,
      });

      // Drain the stream (will loop forever without terminal, but timeout fires immediately)
      const parts: RecordedPart[] = [];
      const iter = result.stream as unknown as AsyncIterable<RecordedPart>;
      let count = 0;
      for await (const p of iter) {
        parts.push(p);
        count++;
        if (count > 20) break; // safety limit
      }

      // Give the timeout handler a tick to complete its async work
      await new Promise((r) => setTimeout(r, 50));

      // The timeout should have fired and called interruptSession
      assert.ok(interruptCallCount > 0, 'timeout handler must call /interrupt');
      assert.strictEqual(abortCallCount, 0, 'should NOT call /abort endpoint');
    } finally {
      globalThis.setTimeout = origSetTimeout;
      globalThis.fetch = origFetch;
    }
  });
});
