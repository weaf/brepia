import { describe, expect, it } from 'vitest';
import OpenSCADError from '@/lib/OpenSCADError';
import {
  __openScadFixPromptTestUtils,
  openScadFixPrompt,
} from '@/lib/openScadFixPrompt';

describe('openScadFixPrompt', () => {
  it('includes bounded compiler diagnostics without duplicating SCAD source', () => {
    const error = new OpenSCADError('Compilation failed', 'E_OPENSCAD', [
      'ERROR: Parser error in file model.scad, line 4',
    ]);

    const prompt = openScadFixPrompt(error);

    expect(prompt).toContain('Fix the current OpenSCAD model');
    expect(prompt).toContain('Compiler code: E_OPENSCAD');
    expect(prompt).toContain('Parser error');
    expect(prompt).toContain(
      'current complete pCAD artifact as the source of truth',
    );
    expect(prompt).not.toContain('cube([');
  });

  it('bounds very large compiler output', () => {
    const huge = `start-${'x'.repeat(20_000)}-tail`;
    const prompt = openScadFixPrompt(
      new OpenSCADError('Compilation failed', '', [huge]),
    );
    const diagnostics = prompt.split('Compiler diagnostics:\n')[1] ?? '';

    expect(diagnostics.length).toBeLessThanOrEqual(
      __openScadFixPromptTestUtils.maxDiagnosticChars,
    );
    expect(diagnostics.endsWith('-tail')).toBe(true);
  });
});
