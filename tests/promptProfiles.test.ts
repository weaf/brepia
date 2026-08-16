/**
 * P04H — Prompt profile tests
 *
 * Covers the required test cases from the local customization plan:
 *  1. Built-in prompt unchanged (loadBuiltinProfile returns correct shape)
 *  2. Built-in profile has immutable fields
 *  3. Fingerprint is stable SHA-256 hash
 *  4. CreatePromptProfileSchema validates correctly
 *  5. UpdatePromptProfileSchema validates correctly
 *  6. Mode must be 'overlay' or 'fork'
 *  7. resolveConversationSystemPrompt returns built-in prompt for NULL
 *  8. resolveConversationSystemPrompt returns built-in prompt for BUILTIN_PROFILE_ID
 *  9. resolveConversationSystemPrompt throws for missing custom profile
 * 10. Fork mode cannot change mode (update throws)
 * 11. Overlay mode can change to fork
 * 12. Prompt templates cannot be empty strings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client — supports .eq().eq() chains and .eq().select().single()
// ---------------------------------------------------------------------------

function makeEqChain(maybeSingle: Mock, single: Mock) {
  return {
    eq: () => makeEqChain(maybeSingle, single),
    select: () => makeEqChain(maybeSingle, single),
    maybeSingle,
    single,
  };
}

const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

const mockSupabase = {
  from: vi.fn(() => ({
    select: () => ({
      eq: () => makeEqChain(mockMaybeSingle, mockSingle),
    }),
    insert: () => ({
      select: () => ({ single: mockSingle }),
    }),
    update: () => ({
      eq: () => ({
        select: () => ({ single: mockSingle }),
      }),
    }),
    delete: () => ({
      eq: () => ({
        select: () => ({ single: mockSingle }),
      }),
    }),
  })),
};

vi.doMock('@/server/supabaseClient', () => ({
  getServiceRoleSupabaseClient: () => mockSupabase,
}));

// ---------------------------------------------------------------------------
// Test 1: Built-in prompt unchanged (loadBuiltinProfile returns correct shape)
// ---------------------------------------------------------------------------

describe('loadBuiltinProfile', () => {
  it('returns a profile with the built-in prompt template', async () => {
    const { loadBuiltinProfile, BUILTIN_PROFILE_ID } = await import(
      '../src/server/promptProfiles'
    );

    const profile = loadBuiltinProfile();

    expect(profile.id).toBe(BUILTIN_PROFILE_ID);
    expect(profile.name).toBe('CADAM Original');
    expect(profile.promptTemplate).toBeDefined();
    expect(profile.promptTemplate.length).toBeGreaterThan(0);
    expect(profile.editable).toBe(false);
    expect(profile.deletable).toBe(false);
    expect(profile.mode).toBe('overlay');
  });

  it('returns consistent results on repeated calls (caching)', async () => {
    const { loadBuiltinProfile } = await import('../src/server/promptProfiles');

    const p1 = loadBuiltinProfile();
    const p2 = loadBuiltinProfile();

    // Same fingerprint due to caching
    expect(p1.fingerprint).toBe(p2.fingerprint);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Built-in profile has immutable fields
// ---------------------------------------------------------------------------

describe('built-in profile immutability', () => {
  it('loadBuiltinProfile always returns editable: false and deletable: false', async () => {
    const { loadBuiltinProfile } = await import('../src/server/promptProfiles');

    for (let i = 0; i < 3; i++) {
      const profile = loadBuiltinProfile();
      expect(profile.editable).toBe(false);
      expect(profile.deletable).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: Fingerprint is stable SHA-256 hash
// ---------------------------------------------------------------------------

describe('fingerprint function', () => {
  it('produces a 12-character hex string', async () => {
    const { fingerprint } = await import('../src/server/promptProfiles');

    const hash = fingerprint('test prompt text');

    expect(hash).toMatch(/^[a-f0-9]{12}$/);
  });

  it('same input always produces the same hash', async () => {
    const { fingerprint } = await import('../src/server/promptProfiles');

    const h1 = fingerprint('identical input');
    const h2 = fingerprint('identical input');

    expect(h1).toBe(h2);
  });

  it('different inputs produce different hashes', async () => {
    const { fingerprint } = await import('../src/server/promptProfiles');

    const h1 = fingerprint('prompt A');
    const h2 = fingerprint('prompt B');

    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// Test 4: CreatePromptProfileSchema validates correctly
// ---------------------------------------------------------------------------

describe('CreatePromptProfileSchema', () => {
  it('accepts a valid create input', async () => {
    const { CreatePromptProfileSchema } = await import('../shared/aiSettings');

    const result = CreatePromptProfileSchema.safeParse({
      name: 'My Profile',
      description: 'A test profile',
      promptTemplate: 'You are a helpful assistant.',
      mode: 'overlay',
    });

    expect(result.success).toBe(true);
  });

  it('accepts input without optional fields', async () => {
    const { CreatePromptProfileSchema } = await import('../shared/aiSettings');

    const result = CreatePromptProfileSchema.safeParse({
      name: 'Minimal',
      promptTemplate: 'Basic prompt',
    });

    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 5: UpdatePromptProfileSchema validates correctly
// ---------------------------------------------------------------------------

describe('UpdatePromptProfileSchema', () => {
  it('accepts a valid update input', async () => {
    const { UpdatePromptProfileSchema } = await import('../shared/aiSettings');

    const result = UpdatePromptProfileSchema.safeParse({
      name: 'Updated Name',
      promptTemplate: 'Updated prompt text',
      mode: 'fork',
    });

    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 6: Mode must be 'overlay' or 'fork'
// ---------------------------------------------------------------------------

describe('mode validation', () => {
  it('rejects invalid mode value', async () => {
    const { CreatePromptProfileSchema } = await import('../shared/aiSettings');

    const result = CreatePromptProfileSchema.safeParse({
      name: 'Bad Mode',
      promptTemplate: 'test',
      mode: 'invalid' as 'overlay',
    });

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test 7: resolveConversationSystemPrompt returns built-in prompt for NULL
// ---------------------------------------------------------------------------

describe('resolveConversationSystemPrompt — NULL profile', () => {
  it('returns the built-in prompt when profileId is null', async () => {
    const { resolveConversationSystemPrompt } = await import(
      '../src/server/promptProfiles'
    );

    const result = await resolveConversationSystemPrompt({
      userId: '00000000-0000-0000-0000-000000000000',
      profileId: null,
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns the built-in prompt when profileId is undefined', async () => {
    const { resolveConversationSystemPrompt } = await import(
      '../src/server/promptProfiles'
    );

    const result = await resolveConversationSystemPrompt({
      userId: '00000000-0000-0000-0000-000000000000',
      profileId: undefined,
    });

    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test 8: resolveConversationSystemPrompt returns built-in prompt for BUILTIN_PROFILE_ID
// ---------------------------------------------------------------------------

describe('resolveConversationSystemPrompt — BUILTIN_PROFILE_ID', () => {
  it('returns the built-in prompt for BUILTIN_PROFILE_ID', async () => {
    const { resolveConversationSystemPrompt, BUILTIN_PROFILE_ID } =
      await import('../src/server/promptProfiles');

    const result = await resolveConversationSystemPrompt({
      userId: '00000000-0000-0000-0000-000000000000',
      profileId: BUILTIN_PROFILE_ID,
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Test 9: resolveConversationSystemPrompt throws for missing custom profile
// ---------------------------------------------------------------------------

describe('resolveConversationSystemPrompt — missing custom profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('throws when custom profile is not found', async () => {
    const { resolveConversationSystemPrompt } = await import(
      '../src/server/promptProfiles'
    );

    await expect(
      resolveConversationSystemPrompt({
        userId: '00000000-0000-0000-0000-000000000000',
        profileId: 'nonexistent-profile-id',
      }),
    ).rejects.toThrow(/not found/);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Fork mode cannot change mode (update throws)
// ---------------------------------------------------------------------------

describe('fork mode immutability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updatePromptProfile throws when changing mode on fork profile', async () => {
    const { updatePromptProfile } = await import(
      '../src/server/promptProfiles'
    );

    mockSingle.mockResolvedValueOnce({
      data: { id: 'profile-id', mode: 'fork' },
      error: null,
    });

    await expect(
      updatePromptProfile('user-id', 'profile-id', {
        name: 'Updated',
        mode: 'overlay',
      }),
    ).rejects.toThrow(/Cannot change mode of a forked profile/);
  });
});

// ---------------------------------------------------------------------------
// Test 11: Overlay mode can change to fork
// ---------------------------------------------------------------------------

describe('overlay mode can change to fork', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updatePromptProfile allows changing overlay to fork', async () => {
    const { updatePromptProfile } = await import(
      '../src/server/promptProfiles'
    );

    const mockUpdateResult = {
      id: 'profile-id',
      user_id: 'user-id',
      name: 'Forked Profile',
      description: null,
      prompt_template: 'forked prompt',
      mode: 'fork',
      base_revision: 'base-123',
      archived: false,
      created_at: '2026-08-16T00:00:00.000Z',
      updated_at: '2026-08-16T12:00:00.000Z',
    };

    mockSingle.mockResolvedValueOnce({
      data: { id: 'profile-id', mode: 'overlay' },
      error: null,
    });

    mockSingle.mockResolvedValueOnce({
      data: mockUpdateResult,
      error: null,
    });

    const result = await updatePromptProfile('user-id', 'profile-id', {
      name: 'Forked Profile',
      mode: 'fork',
    });

    expect(result.mode).toBe('fork');
  });
});

// ---------------------------------------------------------------------------
// Test 12: Prompt templates cannot be empty strings
// ---------------------------------------------------------------------------

describe('prompt template validation', () => {
  it('CreatePromptProfileSchema rejects empty promptTemplate', async () => {
    const { CreatePromptProfileSchema } = await import('../shared/aiSettings');

    const result = CreatePromptProfileSchema.safeParse({
      name: 'Empty Template',
      promptTemplate: '',
    });

    expect(result.success).toBe(false);
  });

  it('UpdatePromptProfileSchema rejects empty promptTemplate', async () => {
    const { UpdatePromptProfileSchema } = await import('../shared/aiSettings');

    const result = UpdatePromptProfileSchema.safeParse({
      promptTemplate: '',
    });

    expect(result.success).toBe(false);
  });
});
