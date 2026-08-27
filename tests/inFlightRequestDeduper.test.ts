import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createInFlightRequestDeduper } from '../src/server/inFlightRequestDeduper';

describe('in-flight request deduper', () => {
  it('shares concurrent work for the same key and allows fresh work after settlement', async () => {
    const deduper = createInFlightRequestDeduper<number>();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = deduper.getOrRun('same-turn', async () => {
      calls += 1;
      await gate;
      return 42;
    });
    const second = deduper.getOrRun('same-turn', async () => {
      calls += 1;
      return 99;
    });

    assert.equal(first.reused, false);
    assert.equal(second.reused, true);
    assert.equal(first.promise, second.promise);
    assert.equal(calls, 1);

    release();
    assert.equal(await first.promise, 42);

    const third = deduper.getOrRun('same-turn', async () => {
      calls += 1;
      return 7;
    });
    assert.equal(third.reused, false);
    assert.equal(await third.promise, 7);
    assert.equal(calls, 2);
  });
});
