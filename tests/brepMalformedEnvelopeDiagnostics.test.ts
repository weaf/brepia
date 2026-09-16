import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { boundedExternalBrepResultRepairDiagnostic } from '../src/server/brepAgentResultDiagnostics';

describe('native BRep malformed external envelope diagnostics', () => {
  it('distinguishes malformed project JSON from a missing envelope', () => {
    const malformed =
      '{"project":{"schemaVersion":1,"id":"cabinet" "name":"broken"},"message":"draft"}';

    const diagnostic = boundedExternalBrepResultRepairDiagnostic(malformed, {
      requireProject: true,
    });

    assert.ok(diagnostic);
    assert.match(diagnostic, /starts a structured `project` envelope/i);
    assert.match(diagnostic, /JSON is malformed/i);
    assert.match(diagnostic, /Correct the JSON syntax first/i);
    assert.doesNotMatch(
      diagnostic,
      /requires one structured JSON result containing a complete `project` object/i,
    );
  });

  it('keeps genuinely unstructured creation output classified as missing envelope', () => {
    const diagnostic = boundedExternalBrepResultRepairDiagnostic(
      'I am still working on the cabinet.',
      { requireProject: true },
    );

    assert.ok(diagnostic);
    assert.match(
      diagnostic,
      /requires one structured JSON result containing a complete `project` object/i,
    );
  });

  it('keeps syntactically valid but canonically invalid projects on the canonical diagnostic path', () => {
    const invalidProject = {
      ...phaseOneCabinetProject,
      resultNodeId: 'missingNode',
    };
    const diagnostic = boundedExternalBrepResultRepairDiagnostic(
      JSON.stringify({ project: invalidProject, message: 'draft' }),
      { requireProject: true },
    );

    assert.ok(diagnostic);
    assert.match(diagnostic, /missingNode|resultNodeId/i);
    assert.doesNotMatch(diagnostic, /JSON is malformed/i);
  });

  it('repairs an unterminated project envelope without weakening follow-up message-only behavior', () => {
    const malformedProject = '{"project":{"schemaVersion":1';
    assert.match(
      boundedExternalBrepResultRepairDiagnostic(malformedProject) ?? '',
      /unterminated|unbalanced/i,
    );

    assert.equal(
      boundedExternalBrepResultRepairDiagnostic(
        'Ordinary follow-up answer with no CAD revision.',
      ),
      undefined,
    );
  });
});
