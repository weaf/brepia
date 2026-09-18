import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const progressSource = fs.readFileSync(
  new URL('../src/components/brep/BrepCreationProgress.tsx', import.meta.url),
  'utf8',
);

describe('BRep generation activity layout', () => {
  it('keeps durable agent activity bounded and independently scrollable', () => {
    assert.match(progressSource, /aria-label="Durable generation activity"/);
    assert.match(progressSource, /max-h-64/);
    assert.match(progressSource, /overflow-y-auto/);
    assert.match(progressSource, /overscroll-contain/);
    assert.match(progressSource, /tabIndex=\{0\}/);
  });
});
