import { describe, expect, it } from 'vitest';
import {
  getAiInstructionProfileDefinition,
  loadBundledInstruction,
} from '@shared/aiInstructionCatalog';
import {
  composeParametricCadToolInstruction,
  parametricCadSpecializationKey,
} from '../src/server/aiInstructionRuntime';

const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

describe('C2.5-C Parametric source-kind CAD specialization', () => {
  it('pins Standard to the Brepia C2.5 revision while leaving CADAM frozen', () => {
    expect(getAiInstructionProfileDefinition('standard')?.revision).toBe(
      'brepia-standard-c25-2026-09-10',
    );
    expect(getAiInstructionProfileDefinition('cadam')?.revision).toBe(
      'cadam-split-2026-08-29',
    );
  });

  it('keeps the Standard Parametric base shared instead of OpenSCAD-specific', () => {
    const shared = loadBundledInstruction('parametric', 'standard');

    expect(shared).toContain('agentic AI CAD editor');
    expect(shared).not.toContain('BOSL2');
    expect(shared).not.toContain('build_parametric_model');
    expect(shared).not.toContain('build_brep_project');
  });

  it('resolves focused OpenSCAD and Native BRep specializations under Standard', () => {
    const openscad = loadBundledInstruction('parametric.openscad', 'standard');
    const brep = loadBundledInstruction('parametric.brep', 'standard');

    expect(openscad).toContain('OpenSCAD CAD specialization');
    expect(openscad).toContain('build_parametric_model');
    expect(openscad).toContain('BOSL2');

    expect(brep).toContain('Native BRep CAD specialization');
    expect(brep).toContain('centered local-origin semantics');
    expect(brep).toContain('center +/- half-extent');
    expect(brep).toContain('subtract operation');
  });

  it('maps only Parametric build tools to source-kind specializations', () => {
    expect(parametricCadSpecializationKey('tool.build_parametric_model')).toBe(
      'parametric.openscad',
    );
    expect(parametricCadSpecializationKey('tool.build_brep_project')).toBe(
      'parametric.brep',
    );
    expect(parametricCadSpecializationKey('tool.answer_user')).toBeUndefined();
  });

  it('composes methodology before the concrete tool contract', () => {
    const specialization = loadBundledInstruction('parametric.brep', 'standard');
    const tool = loadBundledInstruction('tool.build_brep_project', 'standard');
    const composed = composeParametricCadToolInstruction(tool, specialization);

    expect(composed.indexOf('# Native BRep CAD specialization')).toBeLessThan(
      composed.indexOf('## Tool contract'),
    );
    expect(composed).toContain('complete canonical native BRep project snapshot');
  });

  it('keeps CADAM source-kind additions neutral and preserves its frozen Parametric prompt', () => {
    const cadam = loadBundledInstruction('parametric', 'cadam');
    const cadamBrepSpecialization = loadBundledInstruction(
      'parametric.brep',
      'cadam',
    );

    expect(cadam).toContain('creates and modifies OpenSCAD models');
    expect(cadamBrepSpecialization).toBe(
      'Use the CAD methodology already defined by the selected instruction package.',
    );
  });

  it('lets Brepia-derived Test inherit the Standard source-kind split', () => {
    expect(loadBundledInstruction('parametric', 'test')).toBe(
      loadBundledInstruction('parametric', 'standard'),
    );
    expect(loadBundledInstruction('parametric.brep', 'test')).toBe(
      loadBundledInstruction('parametric.brep', 'standard'),
    );
  });

  it('reduces the static direct-BRep instruction footprint versus the pre-split package', () => {
    const legacy =
      loadBundledInstruction('parametric', 'cadam') +
      loadBundledInstruction('tool.build_brep_project', 'cadam');
    const standard =
      loadBundledInstruction('parametric', 'standard') +
      composeParametricCadToolInstruction(
        loadBundledInstruction('tool.build_brep_project', 'standard'),
        loadBundledInstruction('parametric.brep', 'standard'),
      );

    expect(bytes(standard)).toBeLessThan(bytes(legacy));
  });
});
