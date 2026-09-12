import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

const scrollAreaSource = fs.readFileSync(
  new URL('../src/components/ui/scroll-area.tsx', import.meta.url),
  'utf8',
);

describe('ScrollArea layout containment', () => {
  it('prevents Radix intrinsic measurement wrappers from widening vertical panels', () => {
    assert.match(scrollAreaSource, /min-w-0/);
    assert.match(scrollAreaSource, /\[&>div\]:!block/);
    assert.match(scrollAreaSource, /\[&>div\]:w-full/);
    assert.match(scrollAreaSource, /\[&>div\]:max-w-full/);
  });
});
