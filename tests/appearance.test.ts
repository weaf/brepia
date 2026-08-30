import { describe, expect, it } from 'vitest';
import {
  isAppearancePreference,
  resolveAppearance,
} from '../src/contexts/AppearanceContext';

describe('appearance preference', () => {
  it('accepts only supported stored preferences', () => {
    expect(isAppearancePreference('system')).toBe(true);
    expect(isAppearancePreference('light')).toBe(true);
    expect(isAppearancePreference('dark')).toBe(true);
    expect(isAppearancePreference('auto')).toBe(false);
    expect(isAppearancePreference(null)).toBe(false);
  });

  it('resolves explicit light and dark preferences directly', () => {
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });

  it('resolves system preference from the operating system', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
  });
});
