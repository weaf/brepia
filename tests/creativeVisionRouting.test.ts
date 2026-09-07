import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Creative vision routing', () => {
  it('routes text-only Creative agents through the shared vision fallback', () => {
    const source = readFileSync(
      new URL('../src/server/aiChat.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain(
      "if (!directVision) {\n    chatLanguageModel = withVisionFallback(chatLanguageModel, user.id);",
    );
    expect(source).not.toContain(
      "conversation.type === 'parametric' && !directVision",
    );
  });
});
