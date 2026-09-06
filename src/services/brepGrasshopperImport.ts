import { createBrepGrasshopperContract } from '@shared/brepGrasshopperContract';
import {
  validateBrepGrasshopperExecutableGhx,
  type BrepGrasshopperExecutableGhxDiagnostic,
} from '@shared/brepGrasshopperExecutableGhxValidation';
import type { BrepProject } from '@shared/brepProject';

export type BrepGrasshopperGhxImportResult = {
  parameterValues: Record<string, number>;
  changedParameterIds: string[];
};

export class BrepGrasshopperGhxImportError extends Error {
  constructor(
    readonly diagnostics: BrepGrasshopperExecutableGhxDiagnostic[],
  ) {
    const first = diagnostics[0];
    super(
      first
        ? `Returned Grasshopper GHX is not safely round-trippable (${first.code}): ${first.message}`
        : 'Returned Grasshopper GHX is not safely round-trippable.',
    );
    this.name = 'BrepGrasshopperGhxImportError';
  }
}

/**
 * Validate a returned GHX against the exact active immutable Brepia revision.
 * Only the strict v1 parameter-edit subset is recoverable. Unknown graph,
 * wiring, runtime or script mutations remain diagnostics and never become
 * canonical Brepia state.
 */
export async function importBrepGrasshopperGhx(
  project: BrepProject,
  sourceRevisionId: string,
  ghx: string,
): Promise<BrepGrasshopperGhxImportResult> {
  const contract = createBrepGrasshopperContract({
    project,
    sourceRevisionId,
  });
  const validation = await validateBrepGrasshopperExecutableGhx(
    ghx,
    contract,
    'returned',
  );
  if (!validation.accepted) {
    throw new BrepGrasshopperGhxImportError(validation.diagnostics);
  }

  const parameterValues: Record<string, number> = {};
  const changedParameterIds: string[] = [];
  for (const parameter of project.parameters) {
    const value = validation.parameters[parameter.id];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BrepGrasshopperGhxImportError([
        {
          code: 'missing_parameter_value',
          severity: 'error',
          message: `Returned GHX did not recover a finite value for Brepia parameter ${parameter.id}.`,
          path: `parameter:${parameter.id}`,
        },
      ]);
    }
    parameterValues[parameter.id] = value;
    if (value !== parameter.default) changedParameterIds.push(parameter.id);
  }

  return { parameterValues, changedParameterIds };
}
