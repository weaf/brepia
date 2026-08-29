import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadBundledInstruction,
  type AiInstructionProfileId,
} from '@shared/aiInstructionCatalog';

const promptProfileState = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
}));

vi.mock('../src/server/supabaseClient', () => {
  class FakePromptProfileQuery {
    select() {
      return this;
    }

    eq() {
      return this;
    }

    async maybeSingle() {
      return { data: promptProfileState.row, error: null };
    }
  }

  return {
    getServiceRoleSupabaseClient: () => ({
      from: () => new FakePromptProfileQuery(),
    }),
  };
});

vi.mock('../src/server/aiSettings', () => ({
  getPreferencesByUserId: async () => ({
    defaultInstructionProfileId: 'standard',
    defaultPromptProfileId: null,
    defaultCreativePromptProfileId: null,
    instructionProfileDefaults: {},
  }),
}));

import { resolveInstructionProfile } from '../src/server/promptProfiles';

function promptProfileRow(mode: 'overlay' | 'fork', promptTemplate: string) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'user-1',
    name: 'Package layering smoke profile',
    description: null,
    prompt_template: promptTemplate,
    mode,
    scope: 'parametric',
    base_revision: null,
    archived: false,
    created_at: '2026-08-29T00:00:00.000Z',
    updated_at: '2026-08-29T00:00:00.000Z',
  };
}

describe('repository package + custom prompt layering', () => {
  beforeEach(() => {
    promptProfileState.row = null;
  });

  it('keeps legacy/direct callers on CADAM Original when no package is supplied', async () => {
    const resolved = await resolveInstructionProfile({
      userId: 'user-1',
      profileId: null,
      scope: 'parametric',
    });

    expect(resolved).toBe(loadBundledInstruction('parametric', 'cadam'));
  });

  for (const instructionProfileId of ['standard', 'cadam'] as const) {
    it(`applies an Overlay on top of the selected ${instructionProfileId} package`, async () => {
      const customPrompt = `CUSTOM OVERLAY FOR ${instructionProfileId}`;
      promptProfileState.row = promptProfileRow('overlay', customPrompt);

      const resolved = await resolveInstructionProfile({
        userId: 'user-1',
        profileId: '11111111-1111-4111-8111-111111111111',
        scope: 'parametric',
        instructionProfileId: instructionProfileId as AiInstructionProfileId,
      });

      const basePrompt = loadBundledInstruction(
        'parametric',
        instructionProfileId,
      );
      expect(resolved).toBe(
        `${basePrompt}\n\n--- User Custom Instructions ---\n\n${customPrompt}`,
      );
    });
  }

  it('uses Replace/fork as the complete prompt instead of appending the package base', async () => {
    const customPrompt = 'CUSTOM REPLACEMENT PROMPT';
    promptProfileState.row = promptProfileRow('fork', customPrompt);

    const resolved = await resolveInstructionProfile({
      userId: 'user-1',
      profileId: '11111111-1111-4111-8111-111111111111',
      scope: 'parametric',
      instructionProfileId: 'standard',
    });

    expect(resolved).toBe(customPrompt);
    expect(resolved).not.toContain(
      loadBundledInstruction('parametric', 'standard').slice(0, 80),
    );
  });
});
