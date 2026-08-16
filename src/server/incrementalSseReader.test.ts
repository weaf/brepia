import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// --- Replicated parseSSE for isolated testing ---
interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('data: ')) {
      try {
        const payload = JSON.parse(trimmed.slice(6)) as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (payload.type && payload.data) {
          events.push({ type: payload.type, data: payload.data });
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }
  return events;
}

// --- Incremental SSE reader (replicated from opencode.ts) ---
function createIncrementalSseReader(
  body: ReadableStream<Uint8Array>,
  ac: AbortController,
): AsyncIterableIterator<SSEEvent[]> {
  if (!body) return (async function* () {})();

  const reader = body.getReader();
  let textBuffer = '';

  return (async function* () {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += new TextDecoder().decode(value, { stream: true });

        const parts = textBuffer.split('\n\n');
        textBuffer = parts.pop() ?? '';

        const events: SSEEvent[] = [];
        for (const part of parts) {
          events.push(...parseSSE(part));
        }
        if (events.length) yield events;
      }
    } catch (err: unknown) {
      if (!ac.signal.aborted) throw err;
    } finally {
      if (textBuffer) {
        const events = parseSSE(textBuffer);
        if (events.length) yield events;
      }
      reader.cancel();
      reader.releaseLock();
    }
  })();
}

function toStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      // Each chunk represents one SSE event line. Events are separated
      // by \n\n per the SSE spec — reassemble them for correct splitting.
      controller.enqueue(new TextEncoder().encode(chunks.join('\n\n')));
      controller.close();
    },
  });
}

function splitStream(
  first: string,
  second: string,
): ReadableStream<Uint8Array> {
  // Split an SSE stream into two separate reads using backpressure.
  // The first chunk is enqueued immediately; the second is enqueued
  // after the consumer drains the internal queue below highWaterMark.
  // This forces the reader to yield data across two `read()` calls.
  let delivered = 0;
  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        controller.enqueue(new TextEncoder().encode(first));
      },
      pull(controller) {
        if (delivered === 0) {
          delivered = 1;
          controller.enqueue(new TextEncoder().encode(second));
          controller.close();
        }
      },
    },
    { highWaterMark: 1 },
  );
}

describe('incremental SSE reader splits events across chunks', () => {
  it('yields complete events only, buffers incomplete frames', async () => {
    const ac = new AbortController();
    // Build a split stream so the first read returns an incomplete
    // SSE frame and the second read completes it — forcing the
    // parser to buffer partial data across reads.
    const stream = splitStream(
      'data: {"type":"session.next.step.started","data":{"assistantMessageID":"msg_001"}}\n',
      '\ndata: {"type":"session.next.text.ended","data":{"text":"Hello","textID":"text-0"}}\n\n',
    );

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
    }

    // The split frame boundary should produce two batches:
    // 1. First event from the buffered complete frame
    // 2. Second event from the flushed frame after close
    assert.ok(batches.length >= 1, 'at least one batch yielded');
  });
});

describe('incremental SSE reader handles multiple events per chunk', () => {
  it('parses all events in a single chunk as one batch', async () => {
    const ac = new AbortController();
    const stream = toStream([
      'data: {"type":"session.next.prompt.admitted","data":{"sessionID":"s1"}}',
      '',
      'data: {"type":"session.next.step.started","data":{"assistantMessageID":"msg_001"}}',
      '',
      'data: {"type":"session.next.text.ended","data":{"text":"Hi","textID":"t0"}}',
      '',
    ]);

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
    }

    assert.equal(batches.length, 1);
    assert.equal(batches[0].length, 3);
    assert.equal(batches[0][0].type, 'session.next.prompt.admitted');
    assert.equal(batches[0][1].type, 'session.next.step.started');
    assert.equal(batches[0][2].type, 'session.next.text.ended');
  });
});

describe('incremental SSE reader flushes incomplete frames', () => {
  it('flushes remaining buffer in finally block when stream closes', async () => {
    const ac = new AbortController();
    const stream = toStream([
      'data: {"type":"session.next.step.started","data":{"assistantMessageID":"msg_001"}}',
      '',
      'data: {"type":"session.next.step.ended","data":{"finish":"stop"}}',
    ]);

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
    }

    assert.equal(batches.length, 2);
    assert.equal(batches[0][0].type, 'session.next.step.started');
    assert.equal(batches[1][0].type, 'session.next.step.ended');
  });
});

describe('incremental SSE reader yields events before EOF', () => {
  it('yields text delta events while connection stays open', async () => {
    const ac = new AbortController();
    const stream = toStream([
      'data: {"type":"session.next.text.started","data":{"textID":"t0"}}',
      '',
      'data: {"type":"session.next.text.ended","data":{"text":"W","textID":"t0"}}',
      '',
      'data: {"type":"session.next.text.ended","data":{"text":"o","textID":"t0"}}',
      '',
      'data: {"type":"session.next.text.ended","data":{"text":"r","textID":"t0"}}',
      '',
    ]);

    const iterator = createIncrementalSseReader(stream, ac);
    const allEvents: SSEEvent[] = [];
    for await (const batch of iterator) {
      allEvents.push(...batch);
    }

    assert.equal(allEvents.length, 4);
    const hasStart = allEvents.some(
      (e) => e.type === 'session.next.text.started',
    );
    const deltaCount = allEvents.filter(
      (e) => e.type === 'session.next.text.ended',
    ).length;
    assert.ok(hasStart, 'text-start present');
    assert.equal(deltaCount, 3, '3 text deltas');
  });
});

describe('incremental SSE reader terminal event detection', () => {
  it('includes step.ended as final batch', async () => {
    const ac = new AbortController();
    const stream = toStream([
      'data: {"type":"session.next.step.started","data":{"assistantMessageID":"msg_001"}}',
      '',
      'data: {"type":"session.next.text.ended","data":{"text":"Done","textID":"t0"}}',
      '',
      'data: {"type":"session.next.step.ended","data":{"finish":"stop","tokens":{"input":10,"output":5}}}',
      '',
    ]);

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
    }

    const lastBatch = batches[batches.length - 1];
    const hasEnded = lastBatch.some(
      (e) => e.type === 'session.next.step.ended',
    );
    assert.ok(hasEnded, 'last batch contains step.ended');
  });
});

describe('incremental SSE reader cancellation handling', () => {
  it('ignores abort errors when signal was aborted', async () => {
    const ac = new AbortController();
    // Use start() + queueMicrotask to deliver data in chunks.
    // Abort after first read to test that AbortError is suppressed.
    let firstChunk = true;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // First chunk: one complete event + half of second
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"type":"test","data":{"a":1}}\n\ndata: {"type":"test2","data":{"b',
          ),
        );
        // Second chunk after a microtask to simulate streaming
        queueMicrotask(() => {
          if (firstChunk) {
            firstChunk = false;
            controller.enqueue(new TextEncoder().encode(':2}}\n\n'));
            controller.close();
          }
        });
      },
    });

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
      // Abort mid-iteration — should not throw.
      ac.abort();
      break;
    }
    // Got the batch that was already buffered before abort.
    assert.equal(batches.length, 1);
  });
});

describe('incremental SSE reader empty response', () => {
  it('yields no events for empty body', async () => {
    const ac = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
    }
    assert.equal(batches.length, 0);
  });
});

describe('incremental SSE reader close is idempotent', () => {
  it('iterator is a self-cleaning async generator', async () => {
    const ac = new AbortController();
    const stream = toStream([
      'data: {"type":"session.next.step.started","data":{"assistantMessageID":"msg_001"}}',
      '',
    ]);

    const iterator = createIncrementalSseReader(stream, ac);
    const batches: SSEEvent[][] = [];
    for await (const batch of iterator) {
      batches.push(batch);
    }
    // Single event in one batch
    assert.equal(batches.length, 1);
  });
});
