import { describe, expect, it } from 'vitest';
import {
  creativeAgentCandidates,
  resolvePreferredCreativeAgentModel,
  type CreativeAgentCandidate,
} from '../src/lib/creativeAgentSelection';

type Candidate = CreativeAgentCandidate & { name: string };

const models: Candidate[] = [
  {
    id: 'google/vision-controller',
    name: 'Vision controller',
    source: 'builtin',
    supportsTools: true,
    supportsVision: true,
    enabled: true,
    available: true,
  },
  {
    id: 'local/text-controller',
    name: 'Text controller',
    source: 'local',
    supportsTools: true,
    supportsVision: false,
    enabled: true,
    available: true,
  },
  {
    id: 'creative/trellis2',
    name: 'TRELLIS runtime',
    source: 'local',
    supportsTools: true,
    supportsVision: false,
    enabled: true,
    available: true,
  },
  {
    id: 'agent/opencode/qwen',
    name: 'OpenCode agent',
    source: 'opencode',
    supportsTools: true,
    supportsVision: false,
    enabled: true,
    available: true,
  },
  {
    id: 'local/no-tools',
    name: 'No tools',
    source: 'local',
    supportsTools: false,
    supportsVision: false,
    enabled: true,
    available: true,
  },
  {
    id: 'local/disabled',
    name: 'Disabled',
    source: 'local',
    supportsTools: true,
    supportsVision: false,
    enabled: false,
    available: true,
  },
];

describe('Creative controller selection', () => {
  it('keeps only usable controller LLMs and prefers non-vision models', () => {
    expect(creativeAgentCandidates(models).map((model) => model.id)).toEqual([
      'local/text-controller',
      'google/vision-controller',
    ]);
  });

  it('keeps an explicit eligible preference', () => {
    expect(
      resolvePreferredCreativeAgentModel(models, 'google/vision-controller'),
    ).toBe('google/vision-controller');
  });

  it('falls back deterministically when a stored preference is unavailable', () => {
    expect(
      resolvePreferredCreativeAgentModel(models, 'local/missing-controller'),
    ).toBe('local/text-controller');
  });
});
