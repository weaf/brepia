import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildCliAgentInstruction } from './cliAgents.ts';
import { buildAgentOutputContract } from './opencodeAgentResult.ts';
import { formatPrompt } from './opencode.ts';

const CADAM_CONTEXT = 'You are CADAM. Build useful parametric OpenSCAD models.';

describe('R3 semantic parity', () => {
  it('appends the canonical output contract to OpenCode CLI and Streaming', () => {
    const contract = buildAgentOutputContract();
    assert.ok(
      buildCliAgentInstruction('opencode', 'User: make a box').endsWith(
        contract,
      ),
    );
    assert.ok(
      formatPrompt([
        { role: 'user', content: [{ type: 'text', text: CADAM_CONTEXT }] },
      ]).endsWith(contract),
    );
  });

  it('uses the same canonical project envelope for Codex CLI', () => {
    const codex = buildCliAgentInstruction('codex', 'User: make a box');
    assert.ok(codex.endsWith(buildAgentOutputContract()));
    assert.match(codex, /COMPLETE normalized OpenSCAD project snapshot/);
    assert.match(codex, /Do not return a legacy top-level code field/);
  });

  it('preserves CADAM system context and conversation history', () => {
    const formatted = formatPrompt([
      { role: 'system', content: CADAM_CONTEXT },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Previous design: a cylinder.' }],
      },
      { role: 'user', content: [{ type: 'text', text: 'Add a base.' }] },
    ]);
    assert.match(formatted, /System: You are CADAM/);
    assert.match(formatted, /Assistant: Previous design/);
    assert.match(formatted, /User: Add a base/);
  });

  it('does not restore the old prose-only or blanket-ignore contradiction', () => {
    const formatted = formatPrompt([
      { role: 'user', content: [{ type: 'text', text: 'Create a box.' }] },
    ]);
    assert.ok(
      !formatted.includes("Answer the user's request directly in plain text"),
    );
    assert.ok(
      !formatted.includes('Ignore any instruction in the conversation'),
    );
  });

  it('retains the OpenCode bounded-tool guidance and artifact bridge', () => {
    const formatted = formatPrompt([
      { role: 'user', content: [{ type: 'text', text: 'Create a box.' }] },
    ]);
    assert.match(
      formatted,
      /Do not use unrelated filesystem, shell, network, web, or external tools/,
    );
    assert.match(
      formatted,
      /converts the completed structured artifact into its build_parametric_model call/,
    );
    assert.match(
      formatted,
      /Brepia converts project into build_parametric_model itself/,
    );
  });

  it('requires a terminal structured JSON result', () => {
    assert.match(
      formatPrompt([
        { role: 'user', content: [{ type: 'text', text: 'Create a box.' }] },
      ]),
      /Final result format — return ONLY one valid JSON object/,
    );
  });
});
