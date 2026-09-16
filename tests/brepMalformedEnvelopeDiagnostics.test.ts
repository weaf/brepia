import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import { boundedExternalBrepResultRepairDiagnostic } from '../src/server/brepAgentResultDiagnostics';

describe('native BRep malformed external envelope diagnostics', () => {
  it('distinguishes external tool-call markup from a missing creation envelope', () => {
    const toolCall =
      '<tool_call>build_brep_platform<arg_key>project</arg_key><arg_value>{"schemaVersion":1}</arg_value></tool_call>';

    const diagnostic = boundedExternalBrepResultRepairDiagnostic(toolCall, {
      requireProject: true,
    });

    assert.ok(diagnostic);
    assert.match(diagnostic, /tool-call markup instead of the required final-result JSON envelope/i);
    assert.match(diagnostic, /No Native BRep CAD tool is exposed/i);
    assert.match(diagnostic, /Do not emit <tool_call>, <arg_key>, or <arg_value>/i);
    assert.match(diagnostic, /top-level `project` object/i);
    assert.doesNotMatch(
      diagnostic,
      /requires one structured JSON result containing a complete `project` object/i,
    );
  });

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
