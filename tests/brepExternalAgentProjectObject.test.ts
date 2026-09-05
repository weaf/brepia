import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  finishWithParametricToolCall,
  parseAgentResult,
} from '../src/server/opencodeAgentResult';

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

describe('external native BRep project-object snapshots', () => {
  it('preserves canonical geometry roles and semantic points through parsing and tool conversion', () => {
    const expected = {
      ...phaseOneCabinetProject,
      projectObject: {
        footprintNodeId: 'cabinetBody',
        clearanceEnvelopeNodeId: 'cabinetWithCableHole',
        points: [
          {
            id: 'cableEntry',
            kind: 'cable' as const,
            label: 'Cable entry',
            position: [{ parameter: 'width' }, 100, 0] as const,
            direction: [0, 0, 1] as const,
          },
        ],
      },
    };
    const response = JSON.stringify({
      project: expected,
      message: 'Project-object semantics preserved',
    });

    const parsed = parseAgentResult(response, 'brep');
    assert.equal(parsed.project?.projectObject?.footprintNodeId, 'cabinetBody');
    assert.equal(
      parsed.project?.projectObject?.clearanceEnvelopeNodeId,
      'cabinetWithCableHole',
    );
    assert.deepEqual(parsed.project?.projectObject?.points, [
      {
        id: 'cableEntry',
        kind: 'cable',
        label: 'Cable entry',
        position: [{ parameter: 'width' }, 100, 0],
        direction: [0, 0, 1],
      },
    ]);

    const parts = finishWithParametricToolCall(response, FINISH, 'brep');
    assert.equal(parts[0]?.type, 'tool-call');
    if (parts[0]?.type === 'tool-call') {
      const input = JSON.parse(parts[0].input) as {
        project: typeof expected;
      };
      assert.deepEqual(input.project.projectObject, parsed.project?.projectObject);
    }
  });
});
