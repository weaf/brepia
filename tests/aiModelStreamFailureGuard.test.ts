import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../src/server/aiChat.ts', import.meta.url),
  'utf8',
);

describe('AI model stream failure guard', () => {
  it('records provider failures before response finalization', () => {
    expect(source).toContain('let modelStreamFailed = false;');
    expect(source).toContain('let modelStreamFailure: unknown;');
    expect(source).toMatch(
      /onStepFinish: \(\{ stepNumber, finishReason, usage, toolCalls \}\) => \{[\s\S]*?if \(finishReason === 'error'\) \{\s*modelStreamFailed = true;/,
    );
    expect(source).toMatch(
      /onError: \(\{ error \}\) => \{\s*modelStreamFailed = true;\s*if \(modelStreamFailure === undefined\) modelStreamFailure = error;/,
    );
  });

  it('does not advance a failed model stream into response or artifact validation', () => {
    expect(source).toMatch(
      /onFinish: \(\{ steps \}\) => \{\s*activeGeneration\.finish\(\);\s*if \(!modelStreamFailed\) \{\s*void generationRun\.responseReceived\(\);\s*\}/,
    );
    expect(source).toMatch(
      /onFinish: async \(\{ responseMessage, isContinuation \}\) => \{\s*if \(modelStreamFailed\) \{\s*if \(modelStreamFailure !== undefined\) throw modelStreamFailure;\s*throw new Error\('Model stream failed before response finalization\.'\);\s*\}\s*await generationRun\.validatingArtifact/,
    );
  });
});
