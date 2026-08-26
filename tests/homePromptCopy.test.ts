import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HOME_PROMPT_MESSAGES,
  pickHomePromptMessage,
} from '../src/lib/homePromptCopy';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('homePromptCopy', () => {
  it('selects deterministically from the available copy', () => {
    expect(pickHomePromptMessage(() => 0)).toBe(HOME_PROMPT_MESSAGES[0]);
    expect(pickHomePromptMessage(() => 0.999999)).toBe(
      HOME_PROMPT_MESSAGES.at(-1),
    );
  });

  it('does not repeat the previous message in the same browser session', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const first = pickHomePromptMessage(() => 0);
    const second = pickHomePromptMessage(() => 0);

    expect(first).toBe(HOME_PROMPT_MESSAGES[0]);
    expect(second).toBe(HOME_PROMPT_MESSAGES[1]);
    expect(second).not.toBe(first);
  });
});
