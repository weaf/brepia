import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPreferences = vi.fn();
const mockMaybeSingle = vi.fn();
const mockArchiveUpdate = vi.fn();

vi.doMock('../src/server/aiSettings', () => ({
  getPreferencesByUserId: (...args: unknown[]) => mockPreferences(...args),
}));

vi.doMock('../src/server/supabaseClient', () => ({
  getServiceRoleSupabaseClient: () => ({
    from: (table: string) => {
      if (table !== 'prompt_profiles') {
        throw new Error(`Unexpected table in prompt archive test: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: mockMaybeSingle }),
          }),
        }),
        update: (value: unknown) => ({
          eq: (column: string, profileId: string) => ({
            eq: async (ownerColumn: string, userId: string) => {
              mockArchiveUpdate(value, column, profileId, ownerColumn, userId);
              return { error: null };
            },
          }),
        }),
      };
    },
  }),
}));

const noActiveProfiles = {
  defaultPromptProfileId: null,
  defaultCreativePromptProfileId: null,
  instructionProfileDefaults: {},
};

describe('prompt profile archival semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferences.mockResolvedValue(noActiveProfiles);
  });

  it('rejects archiving the active Generative profile', async () => {
    mockPreferences.mockResolvedValue({
      ...noActiveProfiles,
      defaultPromptProfileId: 'profile-active',
    });

    const { ActivePromptProfileError, archivePromptProfile } = await import(
      '../src/server/promptProfiles'
    );

    await expect(
      archivePromptProfile('user-id', 'profile-active'),
    ).rejects.toBeInstanceOf(ActivePromptProfileError);
    expect(mockArchiveUpdate).not.toHaveBeenCalled();
  });

  it('rejects archiving an active auxiliary instruction profile', async () => {
    mockPreferences.mockResolvedValue({
      ...noActiveProfiles,
      instructionProfileDefaults: {
        'vision.reference': 'profile-vision',
      },
    });

    const { archivePromptProfile } = await import(
      '../src/server/promptProfiles'
    );

    await expect(
      archivePromptProfile('user-id', 'profile-vision'),
    ).rejects.toThrow(/Choose another active profile/i);
    expect(mockArchiveUpdate).not.toHaveBeenCalled();
  });

  it('archives an inactive profile instead of hard deleting it', async () => {
    const { archivePromptProfile } = await import(
      '../src/server/promptProfiles'
    );

    await archivePromptProfile('user-id', 'profile-old');

    expect(mockArchiveUpdate).toHaveBeenCalledTimes(1);
    expect(mockArchiveUpdate.mock.calls[0][0]).toMatchObject({ archived: true });
  });

  it('still resolves an archived profile when a historical conversation pins its id', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'profile-archived',
        user_id: 'user-id',
        name: 'Historical profile',
        description: null,
        prompt_template: 'Historical full replacement',
        mode: 'fork',
        scope: 'parametric',
        base_revision: null,
        archived: true,
        created_at: '2026-08-29T00:00:00.000Z',
        updated_at: '2026-08-29T01:00:00.000Z',
      },
      error: null,
    });

    const { resolveConversationSystemPrompt } = await import(
      '../src/server/promptProfiles'
    );

    await expect(
      resolveConversationSystemPrompt({
        userId: 'user-id',
        profileId: 'profile-archived',
        scope: 'parametric',
      }),
    ).resolves.toBe('Historical full replacement');
  });
});
