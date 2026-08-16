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

  it('requires complete runnable OpenSCAD for CAD requests', () => {
    assert.ok(
      has('complete, runnable OpenSCAD program'),
      'contract must require complete runnable OpenSCAD for CAD',
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
