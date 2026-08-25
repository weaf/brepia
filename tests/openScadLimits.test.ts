import { describe, expect, it } from 'vitest';
import {
  OPENSCAD_MAX_OUTPUT_BYTES,
  OPENSCAD_MAX_SOURCE_BYTES,
  assertOpenScadOutputWithinLimit,
  assertOpenScadSourceWithinLimit,
  openScadOutputByteLength,
  openScadUtf8ByteLength,
} from '@/lib/openScadLimits';

describe('OpenSCAD resource limits', () => {
  it('measures UTF-8 bytes rather than JavaScript characters', () => {
    expect(openScadUtf8ByteLength('å')).toBe(2);
  });

  it('accepts source at the limit and rejects source above it', () => {
    const atLimit = 'a'.repeat(OPENSCAD_MAX_SOURCE_BYTES);
    const aboveLimit = `${atLimit}a`;

    expect(() => assertOpenScadSourceWithinLimit(atLimit)).not.toThrow();
    expect(() => assertOpenScadSourceWithinLimit(aboveLimit)).toThrow(
      `${OPENSCAD_MAX_SOURCE_BYTES} UTF-8 bytes`,
    );
  });

  it('counts primary and companion outputs together', () => {
    expect(
      openScadOutputByteLength({
        output: new Uint8Array(3),
        extraOutputs: { off: new Uint8Array(5) },
      }),
    ).toBe(8);
  });

  it('rejects combined output above the configured limit', () => {
    expect(() =>
      assertOpenScadOutputWithinLimit({
        output: { byteLength: OPENSCAD_MAX_OUTPUT_BYTES },
        extraOutputs: { off: { byteLength: 1 } },
      }),
    ).toThrow(`${OPENSCAD_MAX_OUTPUT_BYTES} bytes`);
  });
});
