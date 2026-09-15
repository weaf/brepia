import { describe, expect, it } from 'vitest';
import {
  BrepAiProjectError,
  normalizeBrepAiProjectCandidate,
  validateBrepAiCreation,
  validateBrepAiFollowUp,
} from '../shared/brepAiProject';
import { phaseOneCabinetProject } from '../shared/brepSamples';

function expectGraphIntegrityError(action: () => unknown): BrepAiProjectError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BrepAiProjectError);
    expect((error as BrepAiProjectError).code).toBe('graph_integrity');
    return error as BrepAiProjectError;
  }
  throw new Error('Expected graph-integrity rejection.');
}

describe('BRep AI M0 graph-integrity boundary', () => {
  it('keeps legacy/manual canonical v1 validity separate from AI persistence policy', () => {
    const legacy = {
      ...phaseOneCabinetProject,
      parameters: [
        ...phaseOneCabinetProject.parameters,
        {
          id: 'fakeSlider',
          label: 'Fake slider',
          type: 'number' as const,
          unit: 'mm' as const,
          default: 10,
        },
      ],
    };

    expect(normalizeBrepAiProjectCandidate(legacy).parameters).toHaveLength(3);
    const error = expectGraphIntegrityError(() => validateBrepAiCreation(legacy));
    expect(error.message).toContain('unused parameters: fakeSlider');
  });

  it('rejects an AI follow-up that leaves a feature branch outside all authoritative geometry outputs', () => {
    const next = {
      ...phaseOneCabinetProject,
      nodes: [
        ...phaseOneCabinetProject.nodes,
        {
          id: 'orphanFillet',
          type: 'fillet' as const,
          input: phaseOneCabinetProject.resultNodeId,
          radius: 5,
          selector: { kind: 'parallelToAxis' as const, axis: 'z' as const },
        },
      ],
    };

    const error = expectGraphIntegrityError(() =>
      validateBrepAiFollowUp(phaseOneCabinetProject, next),
    );
    expect(error.message).toContain('orphan nodes: orphanFillet');
  });

  it('allows intentional semantic-only published parameters for placement or semantic point data', () => {
    const candidate = {
      ...phaseOneCabinetProject,
      placement: {
        ...phaseOneCabinetProject.placement,
        origin: [{ parameter: 'placementOffset' }, 0, 0] as const,
      },
      parameters: [
        ...phaseOneCabinetProject.parameters,
        {
          id: 'placementOffset',
          label: 'Placement offset',
          type: 'number' as const,
          unit: 'mm' as const,
          default: 0,
        },
      ],
    };

    expect(validateBrepAiCreation(candidate).project.parameters).toHaveLength(3);
  });

  it('allows an AI follow-up to repair an older source snapshot with ineffective parameters', () => {
    const previous = {
      ...phaseOneCabinetProject,
      parameters: [
        ...phaseOneCabinetProject.parameters,
        {
          id: 'legacyUnused',
          label: 'Legacy unused',
          type: 'number' as const,
          unit: 'mm' as const,
          default: 1,
        },
      ],
    };

    const validation = validateBrepAiFollowUp(previous, phaseOneCabinetProject);
    expect(validation.project.parameters.map((parameter) => parameter.id)).toEqual([
      'height',
      'width',
    ]);
    expect(validation.diff.parameters.removed).toEqual(['legacyUnused']);
  });
});
