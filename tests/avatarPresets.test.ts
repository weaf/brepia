import { describe, expect, it } from 'vitest';
import { AVATAR_PRESETS, isAvatarPresetId } from '../shared/avatarPresets';

describe('avatarPresets', () => {
  it('exposes unique selectable preset ids', () => {
    const ids = AVATAR_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(8);
  });

  it('accepts known preset ids and rejects arbitrary values', () => {
    for (const preset of AVATAR_PRESETS) {
      expect(isAvatarPresetId(preset.id)).toBe(true);
    }

    expect(isAvatarPresetId('')).toBe(false);
    expect(isAvatarPresetId('unknown-avatar')).toBe(false);
    expect(isAvatarPresetId(null)).toBe(false);
  });
});
