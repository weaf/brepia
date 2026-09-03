export const BREP_PROJECT_SCHEMA_VERSION = 1 as const;
export const BREP_PROJECT_MAX_PARAMETERS = 128;
export const BREP_PROJECT_MAX_NODES = 256;
export const BREP_PROJECT_MAX_NODE_INPUTS = 32;
export const BREP_PROJECT_MAX_ID_CHARS = 64;
export const BREP_PROJECT_MAX_NAME_CHARS = 120;
export const BREP_PROJECT_MAX_DESCRIPTION_CHARS = 500;
export const BREP_PROJECT_MAX_ABS_SCALAR = 1_000_000_000;

export type BrepProjectUnitSystem = 'mm';
export type BrepParameterUnit = 'mm' | 'deg' | 'none';
export type BrepAxis = 'x' | 'y' | 'z';

export type BrepParameterReference = {
  parameter: string;
};

export type BrepScalar = number | BrepParameterReference;
export type BrepVector3 = [BrepScalar, BrepScalar, BrepScalar];

export type BrepPublishedNumberParameter = {
  id: string;
  label: string;
  type: 'number';
  unit: BrepParameterUnit;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
};

export type BrepEdgeSelector = {
  kind: 'parallelToAxis';
  axis: BrepAxis;
};

export type BrepBoxNode = {
  id: string;
  type: 'box';
  width: BrepScalar;
  depth: BrepScalar;
  height: BrepScalar;
};

export type BrepCylinderNode = {
  id: string;
  type: 'cylinder';
  radius: BrepScalar;
  height: BrepScalar;
};

export type BrepTransformNode = {
  id: string;
  type: 'transform';
  input: string;
  translate?: BrepVector3;
  rotateDeg?: BrepVector3;
};

export type BrepSubtractNode = {
  id: string;
  type: 'subtract';
  base: string;
  tools: string[];
};

export type BrepFilletNode = {
  id: string;
  type: 'fillet';
  input: string;
  radius: BrepScalar;
  selector: BrepEdgeSelector;
};

export type BrepNode =
  | BrepBoxNode
  | BrepCylinderNode
  | BrepTransformNode
  | BrepSubtractNode
  | BrepFilletNode;

export type BrepProject = {
  schemaVersion: typeof BREP_PROJECT_SCHEMA_VERSION;
  id: string;
  name: string;
  units: BrepProjectUnitSystem;
  parameters: BrepPublishedNumberParameter[];
  nodes: BrepNode[];
  resultNodeId: string;
};

export type BrepProjectErrorCode =
  | 'invalid_schema'
  | 'invalid_id'
  | 'invalid_parameter'
  | 'too_many_parameters'
  | 'duplicate_parameter'
  | 'invalid_node'
  | 'too_many_nodes'
  | 'duplicate_node'
  | 'invalid_reference'
  | 'cycle'
  | 'missing_result';

export class BrepProjectError extends Error {
  constructor(
    public readonly code: BrepProjectErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BrepProjectError';
  }
}

const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const AXES = new Set<BrepAxis>(['x', 'y', 'z']);
const PARAMETER_UNITS = new Set<BrepParameterUnit>(['mm', 'deg', 'none']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeId(value: unknown, kind: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > BREP_PROJECT_MAX_ID_CHARS ||
    !ID_PATTERN.test(value)
  ) {
    throw new BrepProjectError(
      'invalid_id',
      `${kind} id must match ${ID_PATTERN} and be at most ${BREP_PROJECT_MAX_ID_CHARS} characters.`,
    );
  }
  return value;
}

function normalizeText(
  value: unknown,
  field: string,
  maxChars: number,
  required = true,
): string | undefined {
  if (value == null && !required) return undefined;
  if (typeof value !== 'string') {
    throw new BrepProjectError('invalid_schema', `${field} must be text.`);
  }
  const normalized = value.trim();
  if ((required && normalized.length === 0) || normalized.length > maxChars) {
    throw new BrepProjectError(
      'invalid_schema',
      `${field} must be ${required ? 'non-empty and ' : ''}at most ${maxChars} characters.`,
    );
  }
  return normalized;
}

function normalizeNumber(value: unknown, field: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > BREP_PROJECT_MAX_ABS_SCALAR
  ) {
    throw new BrepProjectError(
      'invalid_schema',
      `${field} must be a finite number with absolute value <= ${BREP_PROJECT_MAX_ABS_SCALAR}.`,
    );
  }
  return Object.is(value, -0) ? 0 : value;
}

function normalizeParameter(
  value: unknown,
): BrepPublishedNumberParameter {
  if (!isRecord(value) || value.type !== 'number') {
    throw new BrepProjectError(
      'invalid_parameter',
      'BRep published parameters must currently be numeric parameters.',
    );
  }

  const id = normalizeId(value.id, 'BRep parameter');
  const label = normalizeText(
    value.label,
    `BRep parameter ${id} label`,
    BREP_PROJECT_MAX_NAME_CHARS,
  )!;
  if (typeof value.unit !== 'string' || !PARAMETER_UNITS.has(value.unit as BrepParameterUnit)) {
    throw new BrepProjectError(
      'invalid_parameter',
      `BRep parameter ${id} unit must be mm, deg, or none.`,
    );
  }

  const defaultValue = normalizeNumber(value.default, `BRep parameter ${id} default`);
  const min = value.min == null ? undefined : normalizeNumber(value.min, `BRep parameter ${id} min`);
  const max = value.max == null ? undefined : normalizeNumber(value.max, `BRep parameter ${id} max`);
  const step = value.step == null ? undefined : normalizeNumber(value.step, `BRep parameter ${id} step`);

  if (min != null && max != null && min > max) {
    throw new BrepProjectError(
      'invalid_parameter',
      `BRep parameter ${id} min cannot exceed max.`,
    );
  }
  if (min != null && defaultValue < min) {
    throw new BrepProjectError(
      'invalid_parameter',
      `BRep parameter ${id} default cannot be below min.`,
    );
  }
  if (max != null && defaultValue > max) {
    throw new BrepProjectError(
      'invalid_parameter',
      `BRep parameter ${id} default cannot exceed max.`,
    );
  }
  if (step != null && step <= 0) {
    throw new BrepProjectError(
      'invalid_parameter',
      `BRep parameter ${id} step must be greater than zero.`,
    );
  }

  const description = normalizeText(
    value.description,
    `BRep parameter ${id} description`,
    BREP_PROJECT_MAX_DESCRIPTION_CHARS,
    false,
  );

  return {
    id,
    label,
    type: 'number',
    unit: value.unit as BrepParameterUnit,
    default: defaultValue,
    ...(min != null ? { min } : {}),
    ...(max != null ? { max } : {}),
    ...(step != null ? { step } : {}),
    ...(description ? { description } : {}),
  };
}

function normalizeScalar(
  value: unknown,
  field: string,
  parameterIds: ReadonlySet<string>,
): BrepScalar {
  if (typeof value === 'number') return normalizeNumber(value, field);
  if (!isRecord(value)) {
    throw new BrepProjectError(
      'invalid_node',
      `${field} must be a number or published parameter reference.`,
    );
  }

  const parameter = normalizeId(value.parameter, `${field} parameter reference`);
  if (!parameterIds.has(parameter)) {
    throw new BrepProjectError(
      'invalid_reference',
      `${field} references unknown published parameter ${parameter}.`,
    );
  }
  return { parameter };
}

function normalizeVector3(
  value: unknown,
  field: string,
  parameterIds: ReadonlySet<string>,
): BrepVector3 {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new BrepProjectError('invalid_node', `${field} must contain exactly three scalar values.`);
  }
  return [
    normalizeScalar(value[0], `${field}[0]`, parameterIds),
    normalizeScalar(value[1], `${field}[1]`, parameterIds),
    normalizeScalar(value[2], `${field}[2]`, parameterIds),
  ];
}

function normalizeNodeReference(value: unknown, field: string): string {
  return normalizeId(value, field);
}

function normalizeEdgeSelector(value: unknown, nodeId: string): BrepEdgeSelector {
  if (!isRecord(value) || value.kind !== 'parallelToAxis') {
    throw new BrepProjectError(
      'invalid_node',
      `BRep fillet ${nodeId} currently requires a parallelToAxis edge selector.`,
    );
  }
  if (typeof value.axis !== 'string' || !AXES.has(value.axis as BrepAxis)) {
    throw new BrepProjectError(
      'invalid_node',
      `BRep fillet ${nodeId} selector axis must be x, y, or z.`,
    );
  }
  return { kind: 'parallelToAxis', axis: value.axis as BrepAxis };
}

function normalizeNode(value: unknown, parameterIds: ReadonlySet<string>): BrepNode {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new BrepProjectError('invalid_node', 'BRep nodes must be typed objects.');
  }

  const id = normalizeId(value.id, 'BRep node');

  switch (value.type) {
    case 'box':
      return {
        id,
        type: 'box',
        width: normalizeScalar(value.width, `BRep box ${id} width`, parameterIds),
        depth: normalizeScalar(value.depth, `BRep box ${id} depth`, parameterIds),
        height: normalizeScalar(value.height, `BRep box ${id} height`, parameterIds),
      };

    case 'cylinder':
      return {
        id,
        type: 'cylinder',
        radius: normalizeScalar(value.radius, `BRep cylinder ${id} radius`, parameterIds),
        height: normalizeScalar(value.height, `BRep cylinder ${id} height`, parameterIds),
      };

    case 'transform': {
      if (value.translate == null && value.rotateDeg == null) {
        throw new BrepProjectError(
          'invalid_node',
          `BRep transform ${id} must define translate and/or rotateDeg.`,
        );
      }
      return {
        id,
        type: 'transform',
        input: normalizeNodeReference(value.input, `BRep transform ${id} input`),
        ...(value.translate != null
          ? { translate: normalizeVector3(value.translate, `BRep transform ${id} translate`, parameterIds) }
          : {}),
        ...(value.rotateDeg != null
          ? { rotateDeg: normalizeVector3(value.rotateDeg, `BRep transform ${id} rotateDeg`, parameterIds) }
          : {}),
      };
    }

    case 'subtract': {
      if (
        !Array.isArray(value.tools) ||
        value.tools.length === 0 ||
        value.tools.length > BREP_PROJECT_MAX_NODE_INPUTS
      ) {
        throw new BrepProjectError(
          'invalid_node',
          `BRep subtract ${id} must contain between 1 and ${BREP_PROJECT_MAX_NODE_INPUTS} tool references.`,
        );
      }
      const tools = value.tools.map((tool, index) =>
        normalizeNodeReference(tool, `BRep subtract ${id} tools[${index}]`),
      );
      if (new Set(tools).size !== tools.length) {
        throw new BrepProjectError(
          'invalid_node',
          `BRep subtract ${id} cannot contain duplicate tool references.`,
        );
      }
      return {
        id,
        type: 'subtract',
        base: normalizeNodeReference(value.base, `BRep subtract ${id} base`),
        tools,
      };
    }

    case 'fillet':
      return {
        id,
        type: 'fillet',
        input: normalizeNodeReference(value.input, `BRep fillet ${id} input`),
        radius: normalizeScalar(value.radius, `BRep fillet ${id} radius`, parameterIds),
        selector: normalizeEdgeSelector(value.selector, id),
      };

    default:
      throw new BrepProjectError(
        'invalid_node',
        `Unsupported BRep node type: ${value.type}.`,
      );
  }
}

function nodeDependencies(node: BrepNode): string[] {
  switch (node.type) {
    case 'box':
    case 'cylinder':
      return [];
    case 'transform':
    case 'fillet':
      return [node.input];
    case 'subtract':
      return [node.base, ...node.tools];
  }
}

function validateNodeReferencesAndCycles(nodes: BrepNode[]): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    for (const dependency of nodeDependencies(node)) {
      if (!byId.has(dependency)) {
        throw new BrepProjectError(
          'invalid_reference',
          `BRep node ${node.id} references unknown node ${dependency}.`,
        );
      }
    }
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (nodeId: string) => {
    const current = state.get(nodeId);
    if (current === 'done') return;
    if (current === 'visiting') {
      throw new BrepProjectError(
        'cycle',
        `BRep project dependency graph contains a cycle at ${nodeId}.`,
      );
    }

    state.set(nodeId, 'visiting');
    for (const dependency of nodeDependencies(byId.get(nodeId)!)) visit(dependency);
    state.set(nodeId, 'done');
  };

  for (const node of nodes) visit(node.id);
}

export function normalizeBrepProject(project: unknown): BrepProject {
  if (
    !isRecord(project) ||
    project.schemaVersion !== BREP_PROJECT_SCHEMA_VERSION ||
    !Array.isArray(project.parameters) ||
    !Array.isArray(project.nodes) ||
    project.units !== 'mm'
  ) {
    throw new BrepProjectError(
      'invalid_schema',
      `BRep project schemaVersion must be ${BREP_PROJECT_SCHEMA_VERSION} and units must be mm.`,
    );
  }

  if (project.parameters.length > BREP_PROJECT_MAX_PARAMETERS) {
    throw new BrepProjectError(
      'too_many_parameters',
      `BRep project exceeds ${BREP_PROJECT_MAX_PARAMETERS} published parameters.`,
    );
  }
  if (project.nodes.length === 0 || project.nodes.length > BREP_PROJECT_MAX_NODES) {
    throw new BrepProjectError(
      'too_many_nodes',
      `BRep project must contain between 1 and ${BREP_PROJECT_MAX_NODES} nodes.`,
    );
  }

  const id = normalizeId(project.id, 'BRep project');
  const name = normalizeText(
    project.name,
    'BRep project name',
    BREP_PROJECT_MAX_NAME_CHARS,
  )!;

  const parameters = project.parameters.map(normalizeParameter);
  const parameterIds = new Set<string>();
  for (const parameter of parameters) {
    if (parameterIds.has(parameter.id)) {
      throw new BrepProjectError(
        'duplicate_parameter',
        `Duplicate BRep published parameter id: ${parameter.id}.`,
      );
    }
    parameterIds.add(parameter.id);
  }

  const nodes = project.nodes.map((node) => normalizeNode(node, parameterIds));
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      throw new BrepProjectError(
        'duplicate_node',
        `Duplicate BRep node id: ${node.id}.`,
      );
    }
    nodeIds.add(node.id);
  }

  validateNodeReferencesAndCycles(nodes);

  const resultNodeId = normalizeId(project.resultNodeId, 'BRep result node');
  if (!nodeIds.has(resultNodeId)) {
    throw new BrepProjectError(
      'missing_result',
      `BRep project result node is missing: ${resultNodeId}.`,
    );
  }

  parameters.sort((left, right) => left.id.localeCompare(right.id, 'en-US'));
  nodes.sort((left, right) => left.id.localeCompare(right.id, 'en-US'));

  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id,
    name,
    units: 'mm',
    parameters,
    nodes,
    resultNodeId,
  };
}
