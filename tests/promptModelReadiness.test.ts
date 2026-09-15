import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const promptViewSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/views/PromptView.tsx'),
  'utf8',
);

describe('PromptView Parametric model readiness boundary', () => {
  it('never treats the unconfigured sentinel as a selectable Parametric model', () => {
    expect(promptViewSource).toMatch(
      /model\s*!==\s*UNCONFIGURED_MODEL_ID[\s\S]*parametricModels\.some\(\(candidate\)\s*=>\s*candidate\.id\s*===\s*model\)/,
    );
  });

  it('fails closed before creating or dispatching a Parametric conversation', () => {
    const guards = promptViewSource.match(
      /type\s*===\s*'parametric'\s*&&\s*!parametricModelReady/g,
    );
    expect(guards?.length).toBeGreaterThanOrEqual(2);
    expect(promptViewSource).toContain(
      'No selectable Parametric AI model is ready.',
    );
    expect(promptViewSource).toContain('AI model is still loading');
  });
});
