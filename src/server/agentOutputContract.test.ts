import assert from 'node:assert';
import { describe, it } from 'node:test';
import { buildAgentOutputContract } from './opencodeAgentResult.js';

function contract(): string {
  return buildAgentOutputContract();
}

function has(line: string): boolean {
  return contract().includes(line);
}

function doesNotHave(line: string): boolean {
  return !contract().includes(line);
}

describe('buildAgentOutputContract', () => {
  it('contains "code" and "message" as result keys', () => {
    assert.ok(has('"code"'), 'contract must mention "code" key');
    assert.ok(has('"message"'), 'contract must mention "message" key');
  });

  it('requires complete runnable OpenSCAD when proposing a CAD revision', () => {
    assert.ok(
      has('complete, runnable OpenSCAD program'),
      'contract must require complete runnable OpenSCAD for a CAD revision',
    );
    assert.ok(
      has('new or revised CAD artifact'),
      'contract must distinguish a CAD revision from terminal continuation',
    );
  });

  it('allows a successful build continuation to finish with empty code', () => {
    assert.ok(
      has('After <pcad_build_result>'),
      'contract must explicitly describe the post-build continuation case',
    );
    assert.ok(
      has('code = ""'),
      'a satisfied post-build continuation must be allowed to finish without another artifact',
    );
    assert.ok(
      has('Do not re-emit unchanged code just to finish the turn'),
      'contract must prevent an unchanged build loop',
    );
  });

  it('says non-CAD requests use empty code + message', () => {
    assert.ok(
      has('"" (empty string)'),
      'contract must specify empty code for non-CAD',
    );
    assert.ok(
      has('normal answer'),
      'contract must allow normal message for non-CAD',
    );
  });

  it('forbids an empty terminal result after reasoning', () => {
    assert.ok(
      has('Never finish after reasoning without'),
      'contract must require a final JSON result rather than reasoning only',
    );
  });

  it('prohibits OpenCode filesystem/shell/network/external tool use', () => {
    assert.ok(
      has('Do NOT use OpenCode filesystem'),
      'contract must prohibit filesystem tools',
    );
    assert.ok(has('shell'), 'contract must prohibit shell tools');
    assert.ok(has('network'), 'contract must prohibit network tools');
    assert.ok(has('external tools'), 'contract must prohibit external tools');
  });

  it('explains that pCAD converts code into build_parametric_model', () => {
    assert.ok(
      has('convert a non-empty `code` into build_parametric_model'),
      "contract must explain pCAD's role in tool-call conversion",
    );
    assert.ok(
      has("Do NOT call pCAD's build_parametric_model tool directly"),
      'contract must tell the model NOT to call the tool directly',
    );
  });

  it('bridges CADAM tool-workflow instructions to the JSON result', () => {
    assert.ok(has('that as pCAD-only workflow'));
    assert.ok(has('Do not wait'));
  });

  it('does NOT tell the model to answer in plain text', () => {
    assert.ok(
      doesNotHave('plain text'),
      'contract must NOT contain "plain text" directive',
    );
  });

  it('does NOT blanket-ignore CAD tool semantics', () => {
    assert.ok(
      doesNotHave('Ignore any instruction'),
      'contract must NOT contain blanket ignore instruction',
    );
    assert.ok(
      doesNotHave('ignore all'),
      'contract must NOT contain blanket ignore instruction',
    );
  });

  it('remains compatible with parseAgentResult schema', () => {
    // The contract specifies {"code":"...","message":"..."} which is
    // exactly the shape parseAgentResult expects and parses.
    assert.ok(
      has('"code"'),
      'code key must be present for parseAgentResult JSON parsing',
    );
    assert.ok(
      has('"message"'),
      'message key must be present for parseAgentResult JSON parsing',
    );
    assert.ok(
      doesNotHave('answer in plain text'),
      'no contradictory instruction that would cause prose-only output',
    );
  });
});
