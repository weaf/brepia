import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../src/server/modelCatalog';
import { selectCreativeAgentModel } from '../src/server/creativeAgentModel';

function catalogEntry(
  id: string,
  overrides: Partial<CatalogEntry> = {},
): CatalogEntry {
  return {
    id,
    name: id,
    description: '',
    provider: 'test',
    supportsTools: true,
    supportsThinking: false,
    supportsVision: false,
    source: 'local',
    enabled: true,
    available: true,
    ...overrides,
  };
}

describe('Creative agent model selection', () => {
  it('prefers a non-vision tool model over an earlier vision model', () => {
    const result = selectCreativeAgentModel(
      { settings: {} },
      undefined,
      [
        catalogEntry('local/qwen-vision-30b', { supportsVision: true }),
        catalogEntry('local/qwen3.6-35b-mtp-128k'),
      ],
    );

    expect(result).toEqual({
      modelId: 'local/qwen3.6-35b-mtp-128k',
      source: 'catalog',
    });
  });

  it('uses a vision model as last resort when no non-vision tool model exists', () => {
    const result = selectCreativeAgentModel(
      { settings: {} },
      undefined,
      [catalogEntry('local/qwen-vision-30b', { supportsVision: true })],
    );

    expect(result).toEqual({
      modelId: 'local/qwen-vision-30b',
      source: 'catalog',
    });
  });

  it('keeps an explicitly requested vision model authoritative', () => {
    const result = selectCreativeAgentModel(
      { settings: {} },
      'local/qwen-vision-30b',
      [catalogEntry('local/qwen3.6-35b-mtp-128k')],
    );

    expect(result).toEqual({
      modelId: 'local/qwen-vision-30b',
      source: 'request',
    });
  });
});
