import { describe, expect, it } from 'vitest';
import {
  AI_INSTRUCTION_KEYS,
  AI_INSTRUCTION_PROFILE_DEFINITIONS,
  DEFAULT_AI_INSTRUCTION_PROFILE_ID,
  getAiInstructionProfileDefinition,
  isAiInstructionProfileId,
  loadBundledInstruction,
} from './aiInstructionCatalog';

describe('AI instruction profile packages', () => {
  it('ships Standard as the Brepia default and keeps CADAM separately addressable', () => {
    expect(DEFAULT_AI_INSTRUCTION_PROFILE_ID).toBe('standard');
    expect(isAiInstructionProfileId('standard')).toBe(true);
    expect(isAiInstructionProfileId('cadam')).toBe(true);

    expect(getAiInstructionProfileDefinition('standard')).toMatchObject({
      id: 'standard',
      managedBy: 'brepia',
      revision: 'cadam-split-2026-08-29',
      origin: {
        profile: 'cadam',
        revision: 'cadam-split-2026-08-29',
      },
    });
    expect(getAiInstructionProfileDefinition('cadam')).toMatchObject({
      id: 'cadam',
      managedBy: 'upstream',
      revision: 'cadam-split-2026-08-29',
      lineage: {
        project: 'CADAM',
        revision: 'cadam-split-2026-08-29',
      },
    });
  });

  it('resolves every current instruction key through both initial packages', () => {
    expect(AI_INSTRUCTION_KEYS.length).toBeGreaterThan(0);
    for (const key of AI_INSTRUCTION_KEYS) {
      expect(loadBundledInstruction(key, 'standard').length).toBeGreaterThan(0);
      expect(loadBundledInstruction(key, 'cadam').length).toBeGreaterThan(0);
    }
  });

  it('starts Standard and CADAM from the same frozen split revision', () => {
    for (const key of AI_INSTRUCTION_KEYS) {
      expect(loadBundledInstruction(key, 'standard')).toBe(
        loadBundledInstruction(key, 'cadam'),
      );
    }
  });

  it('exposes only valid package IDs', () => {
    expect(AI_INSTRUCTION_PROFILE_DEFINITIONS.map((profile) => profile.id)).toEqual([
      'cadam',
      'standard',
    ]);
    expect(isAiInstructionProfileId('qwen')).toBe(false);
    expect(isAiInstructionProfileId('builtin:parametric')).toBe(false);
  });
});
