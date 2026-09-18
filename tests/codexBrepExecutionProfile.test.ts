import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'vitest';
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import {
  buildCliAgentArgs,
  buildPersistentCliAgentPrompt,
  cliAgentSessionIdFromPrompt,
  encodeCliAgentSessionToolCallId,
} from '../src/server/cliAgents';
import { phaseOneCabinetProject } from '../shared/brepSamples';

describe('Codex Native BRep execution profile', () => {
  it('preserves the selected Codex model and read-only sandbox for Native BRep', () => {
    const model = 'gpt-5.6-sol';
    const sessionId = '019d1c0a-0137-73f3-bf4a-88c90739150c';

    const openScadArgs = buildCliAgentArgs(
      'codex',
      model,
      sessionId,
      'openscad',
    );
    const brepArgs = buildCliAgentArgs('codex', model, sessionId, 'brep');

    assert.deepEqual(brepArgs, openScadArgs);
    assert.deepEqual(brepArgs, [
      'exec',
      'resume',
      sessionId,
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--json',
      '-m',
      model,
      '-',
    ]);
    assert.equal(brepArgs.includes('--ephemeral'), false);
  });

  it('builds a BRep-only continuation prompt from the Codex BRep transport profile', async () => {
    const transportInstruction = await readFile(
      new URL(
        '../config/ai/instructions/transport-codex-brep.md',
        import.meta.url,
      ),
      'utf8',
    );
    const prompt = [
      { role: 'system', content: 'Native BRep system context' },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Increase the cable hole' }],
      },
    ] as unknown as LanguageModelV3Prompt;

    const text = buildPersistentCliAgentPrompt(
      prompt,
      true,
      transportInstruction,
      {
        sourceKind: 'brep',
        currentBrepProject: phaseOneCabinetProject,
      },
    );

    assert.match(text, /Codex native BRep CAD worker/);
    assert.match(text, /<current_brep_project>/);
    assert.match(text, new RegExp(`"id":"${phaseOneCabinetProject.id}"`));
    assert.match(text, /<user_request>\nIncrease the cable hole/);
    assert.doesNotMatch(text, /current_pcad_artifact/);
    assert.match(
      transportInstruction,
      /Do not use filesystem, shell, network, native-kernel, Python\/build123d, STEP, tessellation, viewer meshes, raw topology identifiers, or unrelated tools/,
    );
  });

  it('resumes the same Codex thread when the prior Native BRep tool call carries its thread id', () => {
    const sessionId = '019d1c0a-0137-73f3-bf4a-88c90739150c';
    const toolCallId = encodeCliAgentSessionToolCallId('codex', sessionId);
    const prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId,
            toolName: 'build_brep_project',
            input: JSON.stringify({
              title: phaseOneCabinetProject.name,
              version: 'v1',
              project: phaseOneCabinetProject,
            }),
          },
        ],
      },
    ] as unknown as LanguageModelV3Prompt;

    assert.equal(cliAgentSessionIdFromPrompt('codex', prompt), sessionId);
  });

  it('keeps OpenCode and Codex Native BRep transport profiles aligned on canonical authority', async () => {
    const [openCodeInstruction, codexInstruction] = await Promise.all([
      readFile(
        new URL(
          '../config/ai/instructions/transport-opencode-brep.md',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../config/ai/instructions/transport-codex-brep.md',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);

    for (const instruction of [openCodeInstruction, codexInstruction]) {
      assert.match(instruction, /complete authoritative canonical BRep snapshot/);
      assert.match(instruction, /complete replacement snapshot, never a patch/);
      assert.match(instruction, /Preserve the project ID/);
      assert.match(instruction, /schema-supported semantic selectors/);
    }
  });
});
