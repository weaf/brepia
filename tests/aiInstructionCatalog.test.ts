import { describe, expect, it } from 'vitest';
import {
  AI_INSTRUCTION_DEFINITIONS,
  AI_INSTRUCTION_KEYS,
  AI_INSTRUCTION_PROFILE_DEFINITIONS,
  AI_RUNTIME_LIMIT_DEFINITIONS,
  DEFAULT_AI_INSTRUCTION_PROFILE_ID,
  getAiInstructionProfileDefinition,
  isAiInstructionKey,
  isAiInstructionProfileId,
  loadBundledInstruction,
  renderInstructionTemplate,
} from '../shared/aiInstructionCatalog';
import {
  InstructionProfileDefaultsSchema,
  RuntimeOverridesSchema,
  runtimeDefaultValue,
} from '../shared/aiInstructionSettings';

describe('repository-driven AI instruction catalog', () => {
  it('loads every manifest instruction from a non-empty repository template', () => {
    expect(AI_INSTRUCTION_DEFINITIONS.length).toBeGreaterThan(0);
    const keys = new Set<string>();
    for (const definition of AI_INSTRUCTION_DEFINITIONS) {
      expect(keys.has(definition.key)).toBe(false);
      keys.add(definition.key);
      expect(isAiInstructionKey(definition.key)).toBe(true);
      expect(
        loadBundledInstruction(definition.key).trim().length,
      ).toBeGreaterThan(0);
    }
  });

  it('registers primary, auxiliary and transport instruction surfaces', () => {
    const keys = new Set(AI_INSTRUCTION_DEFINITIONS.map((entry) => entry.key));
    for (const key of [
      'parametric',
      'creative',
      'tool.build_parametric_model',
      'tool.build_brep_project',
      'vision.reference',
      'conversation.title',
      'context.parametric_attachment',
      'context.brep_project',
      'transport.opencode',
      'transport.codex',
      'transport.opencode_brep',
      'transport.codex_brep',
    ]) {
      expect(keys.has(key)).toBe(true);
    }
  });

  it('renders placeholders without hard-coding context strings in callers', () => {
    expect(
      renderInstructionTemplate('A {{first}} / {{second}}', {
        first: 'one',
        second: 2,
      }),
    ).toBe('A one / 2');
  });
});

describe('AI instruction profile packages', () => {
  it('ships Standard as the Brepia default and keeps CADAM and Test separately addressable', () => {
    expect(DEFAULT_AI_INSTRUCTION_PROFILE_ID).toBe('standard');
    expect(isAiInstructionProfileId('standard')).toBe(true);
    expect(isAiInstructionProfileId('cadam')).toBe(true);
    expect(isAiInstructionProfileId('test')).toBe(true);

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
    expect(getAiInstructionProfileDefinition('test')).toMatchObject({
      id: 'test',
      managedBy: 'brepia',
      extends: 'standard',
      instructions: {},
    });
  });

  it('resolves every current instruction key through all registered packages', () => {
    expect(AI_INSTRUCTION_KEYS.length).toBeGreaterThan(0);
    for (const key of AI_INSTRUCTION_KEYS) {
      expect(loadBundledInstruction(key, 'standard').length).toBeGreaterThan(0);
      expect(loadBundledInstruction(key, 'cadam').length).toBeGreaterThan(0);
      expect(loadBundledInstruction(key, 'test').length).toBeGreaterThan(0);
    }
  });

  it('keeps Standard and CADAM on the same frozen split revision', () => {
    for (const key of AI_INSTRUCTION_KEYS) {
      expect(loadBundledInstruction(key, 'standard')).toBe(
        loadBundledInstruction(key, 'cadam'),
      );
    }
  });

  it('keeps an idle Test slot identical to Standard until an experiment is loaded', () => {
    for (const key of AI_INSTRUCTION_KEYS) {
      expect(loadBundledInstruction(key, 'test')).toBe(
        loadBundledInstruction(key, 'standard'),
      );
    }
  });

  it('exposes only registered package IDs', () => {
    expect(
      AI_INSTRUCTION_PROFILE_DEFINITIONS.map((profile) => profile.id),
    ).toEqual(['cadam', 'standard', 'test']);
    expect(isAiInstructionProfileId('qwen')).toBe(false);
    expect(isAiInstructionProfileId('builtin:parametric')).toBe(false);
  });
});

describe('repository-driven AI runtime settings', () => {
  it('has unique definitions with valid defaults', () => {
    const keys = new Set<string>();
    for (const definition of AI_RUNTIME_LIMIT_DEFINITIONS) {
      expect(keys.has(definition.key)).toBe(false);
      keys.add(definition.key);
      expect(runtimeDefaultValue(definition.key)).toBe(definition.defaultValue);
    }
  });

  it('accepts valid overrides and rejects unknown or out-of-range settings', () => {
    expect(
      RuntimeOverridesSchema.safeParse({
        'chat.parametricMaxSteps': 30,
        'vision.temperature': 0.2,
        'creative.trellisResolution': '512',
        'transport.cliTimeoutMs': 600000,
      }).success,
    ).toBe(true);

    expect(
      RuntimeOverridesSchema.safeParse({
        'chat.parametricMaxSteps': 0,
      }).success,
    ).toBe(false);
    expect(
      RuntimeOverridesSchema.safeParse({
        'creative.trellisResolution': '2048',
      }).success,
    ).toBe(false);
    expect(
      RuntimeOverridesSchema.safeParse({
        'unknown.setting': 1,
      }).success,
    ).toBe(false);
  });

  it('only accepts registered instruction keys in the default map', () => {
    expect(
      InstructionProfileDefaultsSchema.safeParse({
        'vision.reference': null,
        'transport.opencode': null,
      }).success,
    ).toBe(true);
    expect(
      InstructionProfileDefaultsSchema.safeParse({
        'not.registered': null,
      }).success,
    ).toBe(false);
  });
});
