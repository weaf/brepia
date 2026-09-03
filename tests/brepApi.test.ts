import { describe, expect, it } from 'vitest';
import { BREP_EVALUATION_REQUEST_LIMIT_BYTES } from '@/routes/api/brep/evaluate';

describe('BRep evaluation API boundary', () => {
  it('keeps a bounded request envelope before any native execution', () => {
    expect(BREP_EVALUATION_REQUEST_LIMIT_BYTES).toBeGreaterThan(0);
    expect(BREP_EVALUATION_REQUEST_LIMIT_BYTES).toBeLessThanOrEqual(
      1024 * 1024,
    );
  });
});
