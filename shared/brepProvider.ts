import {
  BREP_PROJECT_MAX_ABS_SCALAR,
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
} from './brepProject';

export const BREP_EVALUATION_MAX_BODY_COUNT = 64;
export const BREP_EVALUATION_MAX_VIEWER_VERTICES = 500_000;
export const BREP_EVALUATION_MAX_VIEWER_TRIANGLES = 1_000_000;

export type BrepParameterValues = Record<string, number>;

export type BrepEvaluationRequest = {
  project: BrepProject;
  parameterValues?: BrepParameterValues;
};

export type NormalizedBrepEvaluationRequest = {
  project: BrepProject;
  /** Complete, sorted, resolved public parameter values; the source project is never mutated. */
  parameterValues: BrepParameterValues;
};

export type BrepProviderMetadata = {
  id: string;
  providerVersion: string;
  kernelVersion: string;
};

export type BrepBounds = {
  min: [number, number, number];
  max: [number, number, number];
};

export type BrepViewerMesh = {
  /** Stable body/object identity, derived from Brepia feature IDs rather than OCCT indexes. */
  bodyId: string;
  positions: number[];
  normals: number[];
  indices: number[];
  color?: string;
};

export type BrepEvaluatedBody = {
  /** Brepia feature ID that produced this body. */
  id: string;
  bounds: BrepBounds;
  viewerMesh?: BrepViewerMesh;
};

export type BrepExactExportCapability = {
  format: 'step';
  available: boolean;
};

export type BrepEvaluationSuccess = {
  status: 'success';
  provider: BrepProviderMetadata;
  projectId: string;
  resultNodeId: string;
  bodies: BrepEvaluatedBody[];
  bounds: BrepBounds;
  warnings: string[];
  exactExport: BrepExactExportCapability;
};

export type BrepEvaluationFailure = {
  status: 'failure';
  provider: BrepProviderMetadata;
  code:
    | 'invalid_project'
    | 'unsupported_operation'
    | 'ambiguous_selection'
    | 'evaluation_failed'
    | 'sandbox_unavailable'
    | 'timeout';
  message: string;
  warnings: string[];
};

export type BrepEvaluationResult =
  BrepEvaluationSuccess | BrepEvaluationFailure;

/** This boundary is intentionally process-agnostic. Native implementations live behind a sandbox runner. */
export interface BrepProvider {
  readonly metadata: BrepProviderMetadata;
  evaluate(
    request: NormalizedBrepEvaluationRequest,
    signal?: AbortSignal,
  ): Promise<BrepEvaluationResult>;
}

export class BrepEvaluationRequestError extends Error {
  constructor(
    public readonly code: 'invalid_request' | 'invalid_parameter_value',
    message: string,
  ) {
    super(message);
    this.name = 'BrepEvaluationRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOverride(value: unknown, parameterId: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > BREP_PROJECT_MAX_ABS_SCALAR
  ) {
    throw new BrepEvaluationRequestError(
      'invalid_parameter_value',
      `BRep parameter ${parameterId} override must be a finite bounded number.`,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

export function normalizeBrepEvaluationRequest(
  value: unknown,
): NormalizedBrepEvaluationRequest {
  if (!isRecord(value)) {
    throw new BrepEvaluationRequestError(
      'invalid_request',
      'BRep evaluation request must be an object.',
    );
  }

  let project: BrepProject;
  try {
    project = normalizeBrepProject(value.project);
  } catch (error) {
    if (error instanceof BrepProjectError) {
      throw new BrepEvaluationRequestError('invalid_request', error.message);
    }
    throw error;
  }

  if (value.parameterValues != null && !isRecord(value.parameterValues)) {
    throw new BrepEvaluationRequestError(
      'invalid_request',
      'BRep parameterValues must be an object.',
    );
  }
  const overrides = value.parameterValues ?? {};
  const parametersById = new Map(
    project.parameters.map((parameter) => [parameter.id, parameter]),
  );
  const overrideEntries = Object.entries(overrides);
  if (overrideEntries.length > project.parameters.length) {
    throw new BrepEvaluationRequestError(
      'invalid_request',
      'BRep request has too many parameter overrides.',
    );
  }
  for (const [id] of overrideEntries) {
    if (!parametersById.has(id)) {
      throw new BrepEvaluationRequestError(
        'invalid_parameter_value',
        `Unknown BRep published parameter: ${id}.`,
      );
    }
  }

  const parameterValues: BrepParameterValues = {};
  for (const parameter of project.parameters) {
    const rawValue = Object.prototype.hasOwnProperty.call(
      overrides,
      parameter.id,
    )
      ? overrides[parameter.id]
      : parameter.default;
    const normalized = normalizeOverride(rawValue, parameter.id);
    if (parameter.min != null && normalized < parameter.min) {
      throw new BrepEvaluationRequestError(
        'invalid_parameter_value',
        `BRep parameter ${parameter.id} is below its minimum.`,
      );
    }
    if (parameter.max != null && normalized > parameter.max) {
      throw new BrepEvaluationRequestError(
        'invalid_parameter_value',
        `BRep parameter ${parameter.id} exceeds its maximum.`,
      );
    }
    parameterValues[parameter.id] = normalized;
  }

  return { project, parameterValues };
}
