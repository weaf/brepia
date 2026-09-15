import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildAiTurnProvenanceLines } from '../src/lib/aiTurnProvenanceDisplay';

const aiModels = [
  { id: 'local/qwen3.8-27b', name: 'Qwen3.8-27B' },
  {
    id: 'agent/opencode/llama-swap/qwen3.6-35b-heretic',
    name: 'OpenCode · Qwen3.6-35B Heretic',
  },
  {
    id: 'agent/codex/gpt-5.6-codex',
    name: 'Codex · GPT-5.6 Codex',
  },
];

const meshModels = [{ id: 'trellis-2', name: 'TRELLIS.2' }];

describe('AI turn provenance display', () => {
  it('renders direct historical model metadata without current conversation state', () => {
    assert.deepEqual(
      buildAiTurnProvenanceLines({
        metadata: {
          model: 'local/qwen3.8-27b',
          actualModel: 'local/qwen3.8-27b',
          transportKind: 'direct',
        },
        conversationType: 'parametric',
        aiModels,
        meshModels,
      }),
      ['Qwen3.8-27B'],
    );
  });

  it('renders OpenCode execution mode and underlying model', () => {
    assert.deepEqual(
      buildAiTurnProvenanceLines({
        metadata: {
          model: 'agent/opencode/llama-swap/qwen3.6-35b-heretic',
          actualModel: 'llama-swap/qwen3.6-35b-heretic',
          transportKind: 'opencode',
          openCodeExecutionMode: 'streaming',
        },
        conversationType: 'parametric',
        aiModels,
        meshModels,
      }),
      ['OpenCode · Streaming · Qwen3.6-35B Heretic'],
    );
  });

  it('renders Codex independently from direct providers', () => {
    assert.deepEqual(
      buildAiTurnProvenanceLines({
        metadata: {
          model: 'agent/codex/gpt-5.6-codex',
          actualModel: 'gpt-5.6-codex',
          transportKind: 'codex',
        },
        conversationType: 'parametric',
        aiModels,
        meshModels,
      }),
      ['Codex CLI · GPT-5.6 Codex'],
    );
  });

  it('renders both Creative controller AI and 3D backend', () => {
    assert.deepEqual(
      buildAiTurnProvenanceLines({
        metadata: {
          model: 'trellis-2',
          agentModel: 'local/qwen3.8-27b',
          actualModel: 'local/qwen3.8-27b',
          transportKind: 'direct',
        },
        conversationType: 'creative',
        aiModels,
        meshModels,
      }),
      ['AI: Qwen3.8-27B', '3D: TRELLIS.2'],
    );
  });

  it('degrades old OpenCode messages without inventing CLI versus Streaming', () => {
    assert.deepEqual(
      buildAiTurnProvenanceLines({
        metadata: {
          model: 'agent/opencode/llama-swap/qwen3.6-35b-heretic',
        },
        conversationType: 'parametric',
        aiModels,
        meshModels,
      }),
      ['OpenCode · Qwen3.6-35B Heretic'],
    );
  });
});
