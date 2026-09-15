import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  buildExternalBrepRepairPrompt,
  externalBrepResultRepairDiagnostic,
} from '../src/server/opencodeAgentResult';

const cliAgentSource = fs.readFileSync(
  new URL('../src/server/cliAgents.ts', import.meta.url),
  'utf8',
);

describe('external native BRep repair boundary', () => {
  it('preserves the canonical normalizer diagnostic for an invalid project', () => {
    const invalid = {
      ...phaseOneCabinetProject,
      resultNodeId: 'missingNode',
    };
    const diagnostic = externalBrepResultRepairDiagnostic(
      JSON.stringify({ project: invalid, message: 'Broken candidate' }),
      { requireProject: true },
    );

    assert.ok(diagnostic);
    assert.match(diagnostic, /AI BRep project candidate is invalid/i);
    assert.match(diagnostic, /missingNode|resultNodeId/i);
  });

  it('requires a canonical project for first-turn BRep creation', () => {
    const diagnostic = externalBrepResultRepairDiagnostic(
      JSON.stringify({ message: 'I could not build it.' }),
      { requireProject: true },
    );

    assert.ok(diagnostic);
    assert.match(diagnostic, /requires.*project/i);
  });

  it('allows message-only external BRep follow-up answers', () => {
    assert.equal(
      externalBrepResultRepairDiagnostic(
        JSON.stringify({ message: 'No source change is required.' }),
        { requireProject: false },
      ),
      undefined,
    );
  });

  it('emits bounded repair context without weakening canonical semantics', () => {
    const prompt = buildExternalBrepRepairPrompt({
      diagnostic: 'AI BRep project candidate is invalid: resultNodeId is missing.',
      attempt: 1,
      maxAttempts: 3,
    });

    assert.match(prompt, /<pcad_brep_validation_failure>/);
    assert.match(prompt, /attempt: 1/);
    assert.match(prompt, /maxAttempts: 3/);
    assert.match(prompt, /resultNodeId is missing/);
    assert.match(prompt, /complete JSON object/);
    assert.doesNotMatch(prompt, /ignore validation|disable validation|bypass/i);
  });

  it('keeps CLI BRep repair bounded and resumes the existing agent session', () => {
    assert.match(cliAgentSource, /externalBrepResultRepairDiagnostic/);
    assert.match(cliAgentSource, /buildExternalBrepRepairPrompt/);
    assert.match(
      cliAgentSource,
      /brepValidationAttempt >= validationAttempts/,
    );
    assert.match(cliAgentSource, /runOnce\(sessionId, repairPrompt\)/);
    assert.match(
      cliAgentSource,
      /sourceKind === 'brep' && !options\.currentBrepProject/,
    );
  });
});
