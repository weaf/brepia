import { describe, expect, it } from 'vitest';
import { CreatePromptProfileSchema } from '../shared/aiSettings';
import {
  CREATIVE_AGENT_PROMPT,
  PARAMETRIC_AGENT_PROMPT,
} from '../src/server/aiChat';
import {
  BUILTIN_CREATIVE_PROFILE_ID,
  BUILTIN_PROFILE_ID,
  loadBuiltinProfile,
  resolveConversationSystemPrompt,
} from '../src/server/promptProfiles';

describe('prompt profile scopes', () => {
  it('keeps CADAM Original as the Parametric built-in', () => {
    const profile = loadBuiltinProfile('parametric');
    expect(profile.id).toBe(BUILTIN_PROFILE_ID);
    expect(profile.name).toBe('CADAM Original');
    expect(profile.scope).toBe('parametric');
    expect(profile.promptTemplate).toBe(PARAMETRIC_AGENT_PROMPT);
  });

  it('exposes an independent Creative Original built-in', () => {
    const profile = loadBuiltinProfile('creative');
    expect(profile.id).toBe(BUILTIN_CREATIVE_PROFILE_ID);
    expect(profile.name).toBe('Creative Original');
    expect(profile.scope).toBe('creative');
    expect(profile.promptTemplate).toBe(CREATIVE_AGENT_PROMPT);
  });

  it('resolves the Creative built-in when no profile is pinned', async () => {
    await expect(
      resolveConversationSystemPrompt({
        userId: 'test-user',
        profileId: null,
        scope: 'creative',
      }),
    ).resolves.toBe(CREATIVE_AGENT_PROMPT);
  });

  it('rejects a built-in from the wrong prompt scope', async () => {
    await expect(
      resolveConversationSystemPrompt({
        userId: 'test-user',
        profileId: BUILTIN_PROFILE_ID,
        scope: 'creative',
      }),
    ).rejects.toThrow('belongs to a different mode');
  });

  it('keeps legacy profile creation payloads Parametric-compatible', () => {
    const parsed = CreatePromptProfileSchema.parse({
      name: 'Legacy profile',
      promptTemplate: 'Keep the model simple.',
      mode: 'overlay',
    });
    expect(parsed.scope).toBeUndefined();
  });
});
