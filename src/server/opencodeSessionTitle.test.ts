import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOpenCodeSessionTitle } from './opencode.ts';

describe('OpenCode pCAD session titles', () => {
  it('labels the session with pCAD, model, and the latest user turn', () => {
    const prompt = [
      '<environment instructions>',
      'User: Create a cube',
      'Assistant: Done',
      'User: Make the lid 2 mm thicker',
      'Return the final artifact contract here',
    ].join('\n\n');

    assert.equal(
      buildOpenCodeSessionTitle('llama-swap/qwen3.6-35b-mtp-128k', prompt),
      '[pCAD] qwen3.6-35b-mtp-128k · Make the lid 2 mm thicker',
    );
  });

  it('normalizes and truncates long user text without leaking later prompt content', () => {
    const request =
      'Create a wall-mounted parametric cable organizer with six channels and rounded mounting ears that can be printed without supports';
    const prompt = `System: context\n\nUser: ${request}\nsecond user line\n\nINTERNAL CONTRACT`;
    const title = buildOpenCodeSessionTitle('opencode/big-pickle', prompt);

    assert.equal(
      title,
      '[pCAD] big-pickle · Create a wall-mounted parametric cable organizer with six…',
    );
    assert.equal(title.includes('INTERNAL CONTRACT'), false);
    assert.equal(title.includes('second user line'), false);
  });

  it('still gives sessions a searchable pCAD identity when no user marker exists', () => {
    assert.equal(
      buildOpenCodeSessionTitle('google/gemini-3.6-flash', 'System only'),
      '[pCAD] gemini-3.6-flash',
    );
  });
});
