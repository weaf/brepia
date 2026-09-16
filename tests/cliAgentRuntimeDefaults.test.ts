import { describe, expect, it } from 'vitest';
import { runtimeDefaultValue } from '../shared/aiInstructionSettings';

describe('agent transport runtime defaults', () => {
  it('keeps long local OpenCode work bounded without the former eight-minute wall-clock cutoff', () => {
    expect(runtimeDefaultValue('transport.openCodeTimeoutMs')).toBe(1_200_000);
    expect(runtimeDefaultValue('transport.cliTimeoutMs')).toBe(1_200_000);
  });
});
