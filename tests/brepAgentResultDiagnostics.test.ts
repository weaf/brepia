import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { phaseOneCabinetProject } from '../shared/brepSamples';
import {
  MAX_BREP_REPAIR_DIAGNOSTIC_CHARS,
  boundedExternalBrepResultRepairDiagnostic,
  buildBoundedExternalBrepRepairPrompt,
  inspectStructuredBrepAgentResult,
} from '../src/server/brepAgentResultDiagnostics';

describe('Native BRep structured-result diagnostics', () => {
  it('distinguishes the four structured-result states', () => {
    assert.deepEqual(inspectStructuredBrepAgentResult('plain text only'), {
      kind: 'missing-envelope',
    });

    const messageOnly = inspectStructuredBrepAgentResult(
      JSON.stringify({ message: 'No project change required.' }),
    );
    assert.equal(messageOnly.kind, 'message-only');

    const invalid = inspectStructuredBrepAgentResult(
      JSON.stringify({
        project: { schemaVersion: 1 },
        message: 'candidate',
      }),
    );
    assert.equal(invalid.kind, 'invalid-project');
    if (invalid.kind === 'invalid-project') {
      assert.ok(invalid.diagnostic.length > 0);
      assert.doesNotMatch(invalid.diagnostic, /requires .*`project` object/);
    }

    const valid = inspectStructuredBrepAgentResult(
      JSON.stringify({
        project: phaseOneCabinetProject,
        message: 'updated',
      }),
    );
    assert.equal(valid.kind, 'valid-project');
    if (valid.kind === 'valid-project') {
      assert.equal(valid.result.project?.id, phaseOneCabinetProject.id);
    }
  });

  it('requires a project on first-turn creation without rejecting message-only follow-ups', () => {
    const messageOnly = JSON.stringify({ message: 'Need clarification.' });

    assert.equal(
      boundedExternalBrepResultRepairDiagnostic(messageOnly),
      undefined,
    );
    assert.match(
      boundedExternalBrepResultRepairDiagnostic(messageOnly, {
        requireProject: true,
      }) ?? '',
      /structured result to contain a complete `project` object/,
    );
    assert.match(
      boundedExternalBrepResultRepairDiagnostic('plain text only', {
        requireProject: true,
      }) ?? '',
      /one structured JSON result containing a complete `project` object/,
    );
  });

  it('preserves canonical invalid-project diagnostics instead of collapsing them to missing-project errors', () => {
    const diagnostic = boundedExternalBrepResultRepairDiagnostic(
      JSON.stringify({
        project: { schemaVersion: 1, id: 'incomplete' },
        message: 'candidate',
      }),
      { requireProject: true },
    );

    assert.ok(diagnostic);
    assert.doesNotMatch(diagnostic, /creation requires/);
    assert.doesNotMatch(diagnostic, /structured result to contain/);
  });

  it('bounds repair diagnostics before they enter the shared repair envelope', () => {
    const sentinel = 'TAIL_SENTINEL';
    const diagnostic = `${'x'.repeat(MAX_BREP_REPAIR_DIAGNOSTIC_CHARS + 100)}${sentinel}`;
    const prompt = buildBoundedExternalBrepRepairPrompt({
      diagnostic,
      attempt: 1,
      maxAttempts: 2,
    });

    assert.match(prompt, /<pcad_brep_validation_failure>/);
    assert.match(prompt, /<canonical_diagnostics>/);
    assert.match(prompt, /… diagnostics truncated …/);
    assert.doesNotMatch(prompt, new RegExp(sentinel));

    const canonicalDiagnostics =
      /<canonical_diagnostics>\n([\s\S]*?)\n<\/canonical_diagnostics>/.exec(
        prompt,
      )?.[1];
    assert.ok(canonicalDiagnostics);
    assert.ok(
      canonicalDiagnostics.length <=
        MAX_BREP_REPAIR_DIAGNOSTIC_CHARS +
          '\n… diagnostics truncated …'.length,
    );
  });
});
