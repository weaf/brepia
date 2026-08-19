import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  readPromptDraft,
  writePromptDraft,
  type PromptDraftStorage,
} from '../src/lib/promptDraft';

function createMemoryStorage(): PromptDraftStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('home prompt draft persistence', () => {
  it('restores a prompt after the composer is recreated', () => {
    const storage = createMemoryStorage();

    writePromptDraft(storage, 'draft', 'A threaded enclosure');

    assert.equal(readPromptDraft(storage, 'draft'), 'A threaded enclosure');
  });

  it('clears the saved prompt after submission empties the composer', () => {
    const storage = createMemoryStorage();
    writePromptDraft(storage, 'draft', 'A threaded enclosure');

    writePromptDraft(storage, 'draft', '');

    assert.equal(readPromptDraft(storage, 'draft'), '');
  });

  it('keeps the composer usable when browser storage is unavailable', () => {
    const unavailableStorage: PromptDraftStorage = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {
        throw new Error('storage unavailable');
      },
      removeItem: () => {
        throw new Error('storage unavailable');
      },
    };

    assert.equal(readPromptDraft(unavailableStorage, 'draft'), '');
    assert.doesNotThrow(() =>
      writePromptDraft(unavailableStorage, 'draft', 'still works'),
    );
  });
});
