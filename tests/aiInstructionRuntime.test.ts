import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPreferences = vi.fn();
const mockIn = vi.fn();

vi.doMock('../src/server/aiSettings', () => ({
  getPreferencesByUserId: (...args: unknown[]) => mockPreferences(...args),
}));

vi.doMock('../src/server/promptProfiles', () => ({
  resolveInstructionProfile: vi.fn(),
}));

vi.doMock('../src/server/supabaseClient', () => ({
  getServiceRoleSupabaseClient: () => ({
    from: (table: string) => {
      if (table !== 'prompt_profiles') {
        throw new Error(`Unexpected table in AI runtime test: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: mockIn,
            }),
          }),
        }),
      };
    },
  }),
}));

describe('per-request AI instruction snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferences.mockResolvedValue({
      userId: 'user-id',
      hiddenModelIds: [],
      defaultPromptProfileId: null,
      defaultCreativePromptProfileId: null,
      instructionProfileDefaults: {
        'tool.build_parametric_model': 'profile-build',
        'vision.reference': 'profile-vision',
      },
      runtimeOverrides: {
        'chat.parametricMaxSteps': 25,
      },
      defaultParametricModelId: null,
      defaultCreativeModelId: null,
      visionFastModelId: null,
      visionDeepModelId: null,
    });
    mockIn.mockResolvedValue({
      data: [
        {
          id: 'profile-build',
          mode: 'fork',
          prompt_template: 'Custom build instruction',
          scope: 'tool.build_parametric_model',
        },
        {
          id: 'profile-vision',
          mode: 'fork',
          prompt_template: 'Custom vision instruction {{userRequest}}',
          scope: 'vision.reference',
        },
      ],
      error: null,
    });
  });

  it('bulk-loads selected profiles once and resolves the rest of the turn in memory', async () => {
    const { createUserAiRuntimeContext } = await import(
      '../src/server/aiInstructionRuntime'
    );

    const runtime = await createUserAiRuntimeContext('user-id');

    await expect(
      runtime.instruction('tool.build_parametric_model'),
    ).resolves.toBe('Custom build instruction');
    await expect(
      runtime.instruction('vision.reference', { userRequest: 'make a hook' }),
    ).resolves.toBe('Custom vision instruction make a hook');
    expect(runtime.number('chat.parametricMaxSteps')).toBe(25);

    expect(mockPreferences).toHaveBeenCalledTimes(1);
    expect(mockIn).toHaveBeenCalledTimes(1);
    const selectedIds = mockIn.mock.calls[0]?.[1] as string[] | undefined;
    expect(new Set(selectedIds ?? [])).toEqual(
      new Set(['profile-build', 'profile-vision']),
    );
  });

  it('does not query prompt_profiles when every selected instruction uses repository templates', async () => {
    mockPreferences.mockResolvedValue({
      userId: 'user-id',
      hiddenModelIds: [],
      defaultPromptProfileId: null,
      defaultCreativePromptProfileId: null,
      instructionProfileDefaults: {},
      runtimeOverrides: {},
      defaultParametricModelId: null,
      defaultCreativeModelId: null,
      visionFastModelId: null,
      visionDeepModelId: null,
    });

    const { createUserAiRuntimeContext } = await import(
      '../src/server/aiInstructionRuntime'
    );

    const runtime = await createUserAiRuntimeContext('user-id');
    const instruction = await runtime.instruction('tool.answer_user');

    expect(instruction.length).toBeGreaterThan(0);
    expect(mockIn).not.toHaveBeenCalled();
  });
});
