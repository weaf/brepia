import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenScadWorkerClient } from '@/worker/openScadWorkerClient';
import { WorkerMessageType } from '@/worker/types';

type Listener = EventListenerOrEventListenerObject;

class FakeWorker {
  readonly listeners = new Map<string, Set<Listener>>();
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }
}

function previewMessage(id: string) {
  return {
    id,
    type: WorkerMessageType.PREVIEW,
    data: { code: 'cube(1);', params: [], fileType: 'stl' },
  } as const;
}

function fakeEvent(value: unknown): Event {
  return value as Event;
}

describe('OpenScadWorkerClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves a normal request without terminating the worker', async () => {
    const worker = new FakeWorker();
    const client = new OpenScadWorkerClient(() => worker as unknown as Worker);

    const promise = client.request(previewMessage('one'), [], 1000);
    worker.dispatch(
      'message',
      fakeEvent({ data: { id: 'one', data: { output: new Uint8Array([1]) } } }),
    );

    await expect(promise).resolves.toMatchObject({ output: new Uint8Array([1]) });
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(client.pendingCount()).toBe(0);
    expect(client.getGeneration()).toBe(0);
  });

  it('rejects a compiler error without discarding a healthy worker', async () => {
    const worker = new FakeWorker();
    const client = new OpenScadWorkerClient(() => worker as unknown as Worker);

    const failed = client.request(previewMessage('bad'), [], 1000);
    const failedAssertion = expect(failed).rejects.toThrow(
      'Parser error: syntax error',
    );
    worker.dispatch(
      'message',
      fakeEvent({
        data: {
          id: 'bad',
          err: {
            message: 'Adam did not exit correctly',
            stdErr: ['ERROR: Parser error: syntax error in file input.scad'],
          },
        },
      }),
    );

    await failedAssertion;
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(client.hasWorker()).toBe(true);

    const recovered = client.request(previewMessage('good'), [], 1000);
    worker.dispatch(
      'message',
      fakeEvent({ data: { id: 'good', data: { output: new Uint8Array([4]) } } }),
    );
    await expect(recovered).resolves.toMatchObject({ output: new Uint8Array([4]) });
  });

  it('times out, terminates the worker, rejects all pending requests and clears state', async () => {
    vi.useFakeTimers();
    const worker = new FakeWorker();
    const client = new OpenScadWorkerClient(() => worker as unknown as Worker);

    const first = client.request(previewMessage('one'), [], 25);
    const second = client.request(previewMessage('two'), [], 1000);
    const firstAssertion = expect(first).rejects.toThrow('timed out after 25 ms');
    const secondAssertion = expect(second).rejects.toThrow('timed out after 25 ms');
    expect(client.pendingCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(25);
    await firstAssertion;
    await secondAssertion;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(client.pendingCount()).toBe(0);
    expect(client.hasWorker()).toBe(false);
    expect(client.getGeneration()).toBe(1);
  });

  it('creates a fresh worker after a timeout and completes the next request', async () => {
    vi.useFakeTimers();
    const workers = [new FakeWorker(), new FakeWorker()];
    const createWorker = vi
      .fn()
      .mockImplementation(() => workers.shift() as unknown as Worker);
    const client = new OpenScadWorkerClient(createWorker);

    const timedOut = client.request(previewMessage('one'), [], 10);
    const timedOutAssertion = expect(timedOut).rejects.toThrow(
      'timed out after 10 ms',
    );
    await vi.advanceTimersByTimeAsync(10);
    await timedOutAssertion;

    const recovered = client.request(previewMessage('two'), [], 1000);
    const activeWorker = createWorker.mock.results[1]?.value as unknown as FakeWorker;
    activeWorker.dispatch(
      'message',
      fakeEvent({ data: { id: 'two', data: { output: new Uint8Array([2]) } } }),
    );

    await expect(recovered).resolves.toMatchObject({ output: new Uint8Array([2]) });
    expect(createWorker).toHaveBeenCalledTimes(2);
    expect(client.getGeneration()).toBe(1);
  });

  it('resets and recovers after a worker crash', async () => {
    const workers = [new FakeWorker(), new FakeWorker()];
    const createWorker = vi
      .fn()
      .mockImplementation(() => workers.shift() as unknown as Worker);
    const client = new OpenScadWorkerClient(createWorker);

    const crashed = client.request(previewMessage('one'), [], 1000);
    const crashedAssertion = expect(crashed).rejects.toThrow('boom');
    const firstWorker = createWorker.mock.results[0]?.value as unknown as FakeWorker;
    firstWorker.dispatch('error', fakeEvent({ message: 'boom' }));

    await crashedAssertion;
    expect(firstWorker.terminate).toHaveBeenCalledTimes(1);
    expect(client.hasWorker()).toBe(false);

    const recovered = client.request(previewMessage('two'), [], 1000);
    const secondWorker = createWorker.mock.results[1]?.value as unknown as FakeWorker;
    secondWorker.dispatch(
      'message',
      fakeEvent({ data: { id: 'two', data: { output: new Uint8Array([3]) } } }),
    );
    await expect(recovered).resolves.toMatchObject({ output: new Uint8Array([3]) });
  });

  it('resets on messageerror and rejects pending work', async () => {
    const worker = new FakeWorker();
    const client = new OpenScadWorkerClient(() => worker as unknown as Worker);

    const pending = client.request(previewMessage('one'), [], 1000);
    const pendingAssertion = expect(pending).rejects.toThrow('message error');
    worker.dispatch('messageerror', fakeEvent({}));

    await pendingAssertion;
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(client.pendingCount()).toBe(0);
  });
});
