import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { brepAiBuildInputSchema } from '../shared/brepAiTool';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import { finishWithParametricToolCall } from '../src/server/opencodeAgentResult';

const FINISH = {
  type: 'finish' as const,
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage: {
    inputTokens: {
      total: 0,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 0, text: undefined, reasoning: undefined },
  },
};

describe('external BRep tool input contract', () => {
  it('emits an input accepted by the strict native BRep tool schema', () => {
    const revised = {
      ...phaseOneCabinetProject,
      nodes: phaseOneCabinetProject.nodes.map((node) =>
        node.id === 'cableHole' && node.type === 'cylinder'
          ? { ...node, radius: 75 }
          : node,
      ),
    };
    const response = JSON.stringify({
      project: revised,
      message: 'Cable hole enlarged',
    });

    const parts = finishWithParametricToolCall(response, FINISH, 'brep');
    const toolCall = parts.find((part) => part.type === 'tool-call');

    assert.ok(toolCall && toolCall.type === 'tool-call');
    assert.equal(toolCall.toolName, 'build_brep_project');

    const input = JSON.parse(toolCall.input) as Record<string, unknown>;
    assert.equal('message' in input, false);

    const parsed = brepAiBuildInputSchema.safeParse(input);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;

    const cableHole = parsed.data.project.nodes.find(
      (node) => node.id === 'cableHole' && node.type === 'cylinder',
    );
    assert.equal(cableHole?.type, 'cylinder');
    if (cableHole?.type === 'cylinder') {
      assert.equal(cableHole.radius, 75);
    }
  });
});
