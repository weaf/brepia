import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { shouldDismissToastFromPrimitiveOpenChange } from '../src/hooks/use-toast';

describe('toast persistence', () => {
  it('keeps destructive error toasts open when Radix requests auto-close', () => {
    assert.equal(
      shouldDismissToastFromPrimitiveOpenChange('destructive'),
      false,
    );
  });

  it('allows ordinary toasts to close through the primitive lifecycle', () => {
    assert.equal(shouldDismissToastFromPrimitiveOpenChange('default'), true);
    assert.equal(shouldDismissToastFromPrimitiveOpenChange(undefined), true);
  });
});
