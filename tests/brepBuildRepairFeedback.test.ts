import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import { shouldStopAfterAcceptedBrepBuild } from '../src/server/aiBrepStopCondition';
import { buildPersistentCliAgentPrompt } from '../src/server/cliAgents';
import { buildPersistentOpenCodePrompt } from '../src/server/opencode';

function rejectedBuildPrompt(diagnostic: string): LanguageModelV3Prompt {
  return [
    {
      role: 'user',
      content: [{ type: 'text', text: 'Update the cabinet.' }],
    },
    {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: 'build-1',
          toolName: 'build_brep_project',
          output: { type: 'error-text', value: diagnostic },
        },
      ],
    },
  ] as unknown as LanguageModelV3Prompt;
}

describe('Native BRep server build rejection feedback', () => {
  it('feeds the exact build diagnostic into the next CLI and Streaming model step', () => {
    const diagnostic =
      'AI BRep project candidate is invalid: union operand does not resolve to a solid.';
    const prompt = rejectedBuildPrompt(diagnostic);

    const cli = buildPersistentCliAgentPrompt(prompt, true, 'transport', {
      sourceKind: 'brep',
    });
    const streaming = buildPersistentOpenCodePrompt(prompt, false, 'transport', {
      sourceKind: 'brep',
    });

    for (const nextStepPrompt of [cli, streaming]) {
      assert.match(nextStepPrompt, /<pcad_build_result>/);
      assert.match(nextStepPrompt, new RegExp(diagnostic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(nextStepPrompt, /current_pcad_artifact/);
    }
  });

  it('continues after a rejected build and stops immediately after an accepted build', () => {
    const attempts = new Map<number, Array<{ accepted: boolean }>>();

    attempts.set(0, [{ accepted: false }]);
    assert.equal(shouldStopAfterAcceptedBrepBuild(attempts, 1), false);

    attempts.set(1, [{ accepted: true }]);
    assert.equal(shouldStopAfterAcceptedBrepBuild(attempts, 2), true);
  });
});
