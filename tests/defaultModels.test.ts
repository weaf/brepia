import { describe, expect, it } from 'vitest';
import {
  UNCONFIGURED_MODEL_ID,
  resolveCreativeDefaultModel,
  resolveParametricDefaultModel,
} from '../src/lib/defaultModels';

describe('default model resolution', () => {
  it('uses a saved selectable Parametric model', () => {
    expect(
      resolveParametricDefaultModel('local/qwen', [
        { id: 'openrouter/example' },
        { id: 'local/qwen' },
      ]),
    ).toBe('local/qwen');
  });

  it('uses the first selectable Parametric model when the saved model is unavailable', () => {
    expect(
      resolveParametricDefaultModel('local/missing', [
        { id: 'openrouter/example' },
        { id: 'local/qwen' },
      ]),
    ).toBe('openrouter/example');
  });

  it('returns an explicit unconfigured sentinel when no Parametric model exists', () => {
    expect(resolveParametricDefaultModel(null, [])).toBe(UNCONFIGURED_MODEL_ID);
  });

  it('uses the first enabled Creative backend instead of a hard-coded fallback', () => {
    const resolved = resolveCreativeDefaultModel('not-a-creative-model', [
      { id: 'quality' },
      { id: 'local/native' },
    ]);
    expect(resolved).toBe('quality');
  });

  it('normalizes retired local Creative IDs then respects the selectable catalog', () => {
    expect(
      resolveCreativeDefaultModel('local/trellis-v1', [{ id: 'local/native' }]),
    ).toBe('local/native');
  });

  it('returns an explicit unconfigured sentinel when no Creative backend exists', () => {
    expect(resolveCreativeDefaultModel(null, [])).toBe(UNCONFIGURED_MODEL_ID);
  });
});
