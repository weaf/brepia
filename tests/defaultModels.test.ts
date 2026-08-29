import { describe, expect, it } from 'vitest';
import {
  FALLBACK_CREATIVE_MODEL_ID,
  FALLBACK_PARAMETRIC_MODEL_ID,
  resolveCreativeDefaultModel,
  resolveParametricDefaultModel,
} from '../src/lib/defaultModels';

describe('default model resolution', () => {
  it('uses a saved selectable Parametric model', () => {
    expect(
      resolveParametricDefaultModel('local/qwen', [
        { id: FALLBACK_PARAMETRIC_MODEL_ID },
        { id: 'local/qwen' },
      ]),
    ).toBe('local/qwen');
  });

  it('falls back when the saved Parametric model is unavailable', () => {
    expect(
      resolveParametricDefaultModel('local/missing', [
        { id: FALLBACK_PARAMETRIC_MODEL_ID },
      ]),
    ).toBe(FALLBACK_PARAMETRIC_MODEL_ID);
  });

  it('uses the first selectable Parametric model if the built-in fallback is unavailable', () => {
    expect(
      resolveParametricDefaultModel(null, [{ id: 'agent/opencode/example' }]),
    ).toBe('agent/opencode/example');
  });

  it('uses TRELLIS.2 as the Creative fallback', () => {
    expect(FALLBACK_CREATIVE_MODEL_ID).toBe('local/trellis2');
    expect(resolveCreativeDefaultModel('local/trellis2')).toBe('local/trellis2');
    expect(resolveCreativeDefaultModel('not-a-creative-model')).toBe(
      'local/trellis2',
    );
  });

  it('migrates retired local Creative model IDs forward to TRELLIS.2', () => {
    expect(resolveCreativeDefaultModel('local/trellis-v1')).toBe(
      'local/trellis2',
    );
    expect(resolveCreativeDefaultModel('local/hunyuan3d-2')).toBe(
      'local/trellis2',
    );
    expect(resolveCreativeDefaultModel('local/hunyuan3d-2.1')).toBe(
      'local/trellis2',
    );
  });

  it('falls back from an optional provider when it is not selectable', () => {
    expect(
      resolveCreativeDefaultModel('quality', [{ id: 'local/trellis2' }]),
    ).toBe('local/trellis2');
    expect(
      resolveCreativeDefaultModel('quality', [
        { id: 'local/trellis2' },
        { id: 'quality' },
      ]),
    ).toBe('quality');
  });
});
