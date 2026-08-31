import { describe, expect, it } from 'vitest';
import {
  AiInstructionProfileIdSchema,
  DEFAULT_INSTRUCTION_PROFILE_ID,
} from './aiInstructionSettings';

describe('AI instruction profile settings', () => {
  it('accepts only repository-registered package profile IDs', () => {
    expect(DEFAULT_INSTRUCTION_PROFILE_ID).toBe('standard');
    expect(AiInstructionProfileIdSchema.safeParse('standard').success).toBe(
      true,
    );
    expect(AiInstructionProfileIdSchema.safeParse('cadam').success).toBe(true);
    expect(AiInstructionProfileIdSchema.safeParse('qwen').success).toBe(false);
    expect(
      AiInstructionProfileIdSchema.safeParse('creative-balanced').success,
    ).toBe(false);
  });
});
