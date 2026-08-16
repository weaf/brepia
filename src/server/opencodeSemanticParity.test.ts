import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCliAgentInstruction } from './cliAgents.ts';
import { buildAgentOutputContract } from './opencodeAgentResult.ts';
import { formatPrompt } from './opencode.ts';

const CADAM_CONTEXT = 'You are CADAM. Build useful parametric OpenSCAD models.';

describe('R3 semantic parity', () => {
  it('appends the canonical output contract to both OpenCode transports', () => {
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

  it('keeps Codex CLI instruction independent of the OpenCode contract', () => {
    assert.ok(
      !buildCliAgentInstruction('codex', 'User: make a box').includes(
        'Final result format —',
      ),
    );
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

  it('retains the OpenCode own-tool prohibition and pCAD artifact bridge', () => {
    const formatted = formatPrompt([
      { role: 'user', content: [{ type: 'text', text: 'Create a box.' }] },
    ]);
    assert.match(
      formatted,
      /Do NOT use OpenCode filesystem, shell, network, web, or external tools/,
    );
    assert.match(formatted, /pCAD.*build_parametric_model/);
    assert.match(formatted, /pCAD-only workflow/);
  });

  it('requires a terminal JSON response instead of reasoning-only completion', () => {
    assert.match(
      formatPrompt([
        { role: 'user', content: [{ type: 'text', text: 'Create a box.' }] },
      ]),
      /Never finish after reasoning without/,
    );
  });
});
