import { describe, expect, it } from 'vitest';
import {
  AI_CONTEXT_CONSERVATIVE_TOKEN_MULTIPLIER,
  AiContextBudgetError,
  assertAiHardContextBudget,
  deriveAiHardContextBudget,
  deriveMinimumOutputReserveTokens,
  estimateModelMessagesForHardBudget,
} from '../src/server/aiContextBudget';

describe('C5 hard AI context budget', () => {
  it('does not invent a hard limit when model context metadata is unknown', () => {
    const budget = deriveAiHardContextBudget({
      estimatedInputTokens: 50000,
      contextWindowTokens: null,
      configuredMaxOutputTokens: 64000,
      modelOutputLimitTokens: null,
      safetyMarginTokens: null,
    });
    expect(budget.enforced).toBe(false);
    expect(budget.fits).toBeNull();
    expect(budget.effectiveMaxOutputTokens).toBe(64000);
    expect(() => assertAiHardContextBudget(budget)).not.toThrow();
  });

  it('accepts the measured C3 follow-up and derives a safe output ceiling', () => {
    const budget = deriveAiHardContextBudget({
      estimatedInputTokens: 59628,
      contextWindowTokens: 131072,
      configuredMaxOutputTokens: 64000,
      modelOutputLimitTokens: null,
      safetyMarginTokens: 8192,
    });
    expect(AI_CONTEXT_CONSERVATIVE_TOKEN_MULTIPLIER).toBe(1.75);
    expect(budget).toMatchObject({
      enforced: true,
      fits: true,
      conservativeInputTokens: 104349,
      minimumOutputReserveTokens: 16384,
      hardInputLimitTokens: 106496,
      hardInputHeadroomTokens: 2147,
      maximumSafeOutputTokens: 18531,
      effectiveMaxOutputTokens: 18531,
    });
  });

  it('rejects the measured pre-C2 oversized request class', () => {
    const budget = deriveAiHardContextBudget({
      estimatedInputTokens: 107862,
      contextWindowTokens: 131072,
      configuredMaxOutputTokens: 64000,
      modelOutputLimitTokens: null,
      safetyMarginTokens: 8192,
    });
    expect(budget.enforced).toBe(true);
    expect(budget.fits).toBe(false);
    expect(budget.conservativeInputTokens).toBe(188759);
    expect(() => assertAiHardContextBudget(budget)).toThrowError(AiContextBudgetError);
  });

  it('leaves sufficient output room for the accepted post-C2.5 first turn', () => {
    const budget = deriveAiHardContextBudget({
      estimatedInputTokens: 36419,
      contextWindowTokens: 131072,
      configuredMaxOutputTokens: 64000,
      modelOutputLimitTokens: null,
      safetyMarginTokens: 8192,
    });
    expect(budget.fits).toBe(true);
    expect(budget.conservativeInputTokens).toBe(63734);
    expect(budget.effectiveMaxOutputTokens).toBe(59146);
    expect(budget.effectiveMaxOutputTokens).toBeGreaterThan(25674);
  });

  it('respects configured model output limits', () => {
    const budget = deriveAiHardContextBudget({
      estimatedInputTokens: 20000,
      contextWindowTokens: 131072,
      configuredMaxOutputTokens: 64000,
      modelOutputLimitTokens: 12000,
      safetyMarginTokens: 8192,
    });
    expect(budget.configuredOutputCapTokens).toBe(12000);
    expect(budget.minimumOutputReserveTokens).toBe(12000);
    expect(budget.effectiveMaxOutputTokens).toBe(12000);
  });

  it('scales the minimum output reserve with model context', () => {
    expect(deriveMinimumOutputReserveTokens(32768, 64000)).toBe(4096);
    expect(deriveMinimumOutputReserveTokens(65536, 64000)).toBe(8192);
    expect(deriveMinimumOutputReserveTokens(131072, 64000)).toBe(16384);
    expect(deriveMinimumOutputReserveTokens(262144, 64000)).toBe(16384);
  });

  it('charges image payloads more aggressively than ordinary UTF-8', () => {
    const encodedImage = 'A'.repeat(4000);
    const estimate = estimateModelMessagesForHardBudget([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Inspect this image.' },
          { type: 'image', image: `data:image/png;base64,${encodedImage}` },
        ],
      },
    ]);
    expect(estimate.imageCount).toBe(1);
    expect(estimate.imageBase64Chars).toBe(4000);
    expect(estimate.imageEstimatedTokens).toBe(2000);
    expect(estimate.estimatedTokens).toBeGreaterThanOrEqual(2000);
  });
});
