import {
  normalizeBrepGrasshopperContract,
  type BrepGrasshopperContract,
} from './brepGrasshopperContract.ts';
import { createBrepGrasshopperPackagePlan } from './brepGrasshopperPackagePlan.ts';
import type {
  BrepBoxNode,
  BrepProjectObjectPoint,
  BrepScalar,
  BrepVector3,
} from './brepProject.ts';

export const BREP_GRASSHOPPER_RHINO_PYTHON3_COMPONENT_GUID =
  '719467e6-7cf5-4848-99b0-c5dd57e5442c';
export const BREP_GRASSHOPPER_RHINOCODE_LIBRARY_GUID =
  '066d0a87-236f-4eae-a0f4-9e42f5327962';
export const BREP_GRASSHOPPER_SCRIPT_PARAMETER_GUID =
  '08908df5-fa14-4982-9ab2-1aa0927566aa';
export const BREP_GRASSHOPPER_SCRIPT_DOUBLE_HINT_GUID =
  '19ff81a2-dc4f-4035-8de9-26224c561321';
export const BREP_GRASSHOPPER_SCRIPT_OBJECT_HINT_GUID =
  '6a184b65-baa3-42d1-a548-3915b401de53';

const SCRIPT_PLAN_NAMESPACE = 'brepia-grasshopper-rhino-script-v1';

export type BrepGrasshopperRhinoScriptInput = {
  inputId: string;
  variableName: string;
  nickname: string;
  kind: 'number' | 'placement';
  instanceGuid: string;
  sourceObjectGuid: string | null;
  converterType: 'System.Double' | 'System.Object';
  typeHintGuid: string;
};

export type BrepGrasshopperRhinoScriptOutput = {
  outputId:
    | 'result'
    | 'footprint'
    | 'clearanceEnvelope'
    | 'maintenanceEnvelope'
    | 'connectionPoints'
    | 'mountingPoints'
    | 'cablePoints'
    | 'metadata';
  variableName: string;
  nickname: string;
  instanceGuid: string;
};

export type BrepGrasshopperRhinoScriptPlan = {
  kind: 'brepia-rhino-python3-script-plan';
  schemaVersion: 1;
  projectId: string;
  sourceRevisionId: string;
  componentInstanceGuid: string;
  componentNickname: string;
  inputs: BrepGrasshopperRhinoScriptInput[];
  outputs: BrepGrasshopperRhinoScriptOutput[];
  source: string;
  sourceSha256: string;
};

export class BrepGrasshopperRhinoScriptError extends Error {
  constructor(
    readonly code: 'unsupported_model' | 'invalid_model',
    message: string,
  ) {
    super(message);
    this.name = 'BrepGrasshopperRhinoScriptError';
  }
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function encodeStableSegments(parts: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const segments = [SCRIPT_PLAN_NAMESPACE, ...parts].map((part) =>
    encoder.encode(part),
  );
  const byteLength = segments.reduce(
    (total, segment) => total + 4 + segment.length,
    0,
  );
  const encoded = new Uint8Array(byteLength);
  const view = new DataView(encoded.buffer);
  let offset = 0;
  for (const segment of segments) {
    view.setUint32(offset, segment.length, false);
    offset += 4;
    encoded.set(segment, offset);
    offset += segment.length;
  }
  return encoded;
}

async function stableGuid(parts: string[]): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encodeStableSegments(parts)),
  );
  const uuid = digest.slice(0, 16);
  uuid[6] = ((uuid[6] ?? 0) & 0x0f) | 0x80;
  uuid[8] = ((uuid[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(uuid);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pythonNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new BrepGrasshopperRhinoScriptError(
      'invalid_model',
      'Rhino script numeric literals must be finite.',
    );
  }
  return String(Object.is(value, -0) ? 0 : value);
}

function parameterVariables(contract: BrepGrasshopperContract): Map<string, string> {
  return new Map(
    contract.source.parameters.map((parameter, index) => [
      parameter.id,
      `brepiaP${index}`,
    ]),
  );
}

function scalarExpression(
  value: BrepScalar,
  variables: ReadonlyMap<string, string>,
): string {
  if (typeof value === 'number') return pythonNumber(value);
  const variable = variables.get(value.parameter);
  if (!variable) {
    throw new BrepGrasshopperRhinoScriptError(
      'invalid_model',
      `Unknown parameter reference ${value.parameter} in Rhino script generation.`,
    );
  }
  return variable;
}

function vectorExpression(
  value: BrepVector3,
  variables: ReadonlyMap<string, string>,
  kind: 'point' | 'vector',
): string {
  const type = kind === 'point' ? 'Point3d' : 'Vector3d';
  return `rg.${type}(${value
    .map((entry) => scalarExpression(entry, variables))
    .join(', ')})`;
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

function stableJson(value: unknown): string {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  throw new BrepGrasshopperRhinoScriptError(
    'invalid_model',
    'Unsupported value in deterministic metadata serialization.',
  );
}

function pointConstruction(
  point: BrepProjectObjectPoint,
  variables: ReadonlyMap<string, string>,
): string {
  const position = vectorExpression(point.position, variables, 'point');
  return `brepia_transform_point(${position}, brepiaTransform)`;
}

function pointsForKind(
  contract: BrepGrasshopperContract,
  kind: BrepProjectObjectPoint['kind'],
  variables: ReadonlyMap<string, string>,
): string {
  const points = (contract.source.projectObject?.points ?? []).filter(
    (point) => point.kind === kind,
  );
  if (points.length === 0) return '[]';
  return `[${points
    .map((point) => pointConstruction(point, variables))
    .join(', ')}]`;
}

function roleExpression(
  nodeId: string | undefined,
  resultNodeId: string,
): string {
  if (!nodeId) return 'None';
  if (nodeId !== resultNodeId) {
    throw new BrepGrasshopperRhinoScriptError(
      'unsupported_model',
      `Phase 8E box GHX subset cannot emit auxiliary role node ${nodeId}; only the result box may be reused.`,
    );
  }
  return 'brepiaResult.DuplicateBrep()';
}

function assertSupportedBoxContract(contract: BrepGrasshopperContract): BrepBoxNode {
  const nodes = contract.source.nodes;
  if (nodes.length !== 1 || nodes[0]?.type !== 'box') {
    throw new BrepGrasshopperRhinoScriptError(
      'unsupported_model',
      'Phase 8E Rhino script generation currently supports exactly one box node.',
    );
  }
  if (contract.source.resultNodeId !== nodes[0].id) {
    throw new BrepGrasshopperRhinoScriptError(
      'unsupported_model',
      'Phase 8E Rhino script box must be the canonical result node.',
    );
  }
  return nodes[0];
}

function buildSource(
  contract: BrepGrasshopperContract,
  box: BrepBoxNode,
  variables: ReadonlyMap<string, string>,
): string {
  const width = scalarExpression(box.width, variables);
  const depth = scalarExpression(box.depth, variables);
  const height = scalarExpression(box.height, variables);
  const placement = contract.source.placement;
  const defaultOrigin = vectorExpression(placement.origin, variables, 'point');
  const defaultXAxis = vectorExpression(placement.xAxis, variables, 'vector');
  const defaultYAxis = vectorExpression(placement.yAxis, variables, 'vector');
  const definition = contract.source.projectObject;
  const footprint = roleExpression(
    definition?.footprintNodeId,
    contract.source.resultNodeId,
  );
  const clearance = roleExpression(
    definition?.clearanceEnvelopeNodeId,
    contract.source.resultNodeId,
  );
  const maintenance = roleExpression(
    definition?.maintenanceEnvelopeNodeId,
    contract.source.resultNodeId,
  );
  const connections = pointsForKind(contract, 'connection', variables);
  const mounting = pointsForKind(contract, 'mounting', variables);
  const cable = pointsForKind(contract, 'cable', variables);
  const metadataEnvelope = stableJson({
    projectId: contract.model.projectId,
    projectName: contract.model.projectName,
    projectSchemaVersion: contract.model.projectSchemaVersion,
    sourceRevisionId: contract.model.sourceRevisionId,
    metadata: contract.source.metadata ?? null,
  });

  return `# Brepia Rhino Python 3 script v1\n# projectId: ${contract.model.projectId}\n# sourceRevisionId: ${contract.model.sourceRevisionId}\nimport Rhino.Geometry as rg\n\ndef brepia_normalize_plane(source):\n    if source is None or not source.IsValid:\n        raise ValueError("Brepia target Plane is invalid.")\n    return source\n\ndef brepia_transform_point(point, transform):\n    point.Transform(transform)\n    return point\n\nbrepiaWidth = float(${width})\nbrepiaDepth = float(${depth})\nbrepiaHeight = float(${height})\nif brepiaWidth <= 0.0 or brepiaDepth <= 0.0 or brepiaHeight <= 0.0:\n    raise ValueError("Brepia box dimensions must be greater than zero.")\n\nbrepiaLocal = rg.Box(\n    rg.Plane.WorldXY,\n    rg.Interval(-brepiaWidth / 2.0, brepiaWidth / 2.0),\n    rg.Interval(-brepiaDepth / 2.0, brepiaDepth / 2.0),\n    rg.Interval(0.0, brepiaHeight),\n).ToBrep()\n\nbrepiaDefaultPlane = brepia_normalize_plane(\n    rg.Plane(${defaultOrigin}, ${defaultXAxis}, ${defaultYAxis})\n)\nbrepiaTargetPlane = (\n    brepia_normalize_plane(brepiaPlacement)\n    if isinstance(brepiaPlacement, rg.Plane)\n    else brepiaDefaultPlane\n)\nbrepiaTransform = rg.Transform.PlaneToPlane(rg.Plane.WorldXY, brepiaTargetPlane)\nif not brepiaLocal.Transform(brepiaTransform):\n    raise RuntimeError("Rhino could not apply Brepia placement.")\n\nbrepiaResult = brepiaLocal\nresult = brepiaResult\nfootprint = ${footprint}\nclearanceEnvelope = ${clearance}\nmaintenanceEnvelope = ${maintenance}\nconnectionPoints = ${connections}\nmountingPoints = ${mounting}\ncablePoints = ${cable}\nmetadata = ${pythonString(metadataEnvelope)}\n`;
}

export async function createBrepGrasshopperRhinoScriptPlan(
  value: unknown,
): Promise<BrepGrasshopperRhinoScriptPlan> {
  const contract = normalizeBrepGrasshopperContract(value);
  const box = assertSupportedBoxContract(contract);
  const packagePlan = await createBrepGrasshopperPackagePlan(contract);
  const variables = parameterVariables(contract);

  const numberInputs = await Promise.all(
    packagePlan.controls.map(async (control, index): Promise<BrepGrasshopperRhinoScriptInput> => ({
      inputId: control.inputId,
      variableName: variables.get(control.inputId) ?? `brepiaP${index}`,
      nickname: control.label,
      kind: 'number',
      instanceGuid: await stableGuid([
        contract.model.projectId,
        'script-input',
        control.inputId,
      ]),
      sourceObjectGuid: control.instanceGuid,
      converterType: 'System.Double',
      typeHintGuid: BREP_GRASSHOPPER_SCRIPT_DOUBLE_HINT_GUID,
    })),
  );

  const placementInput: BrepGrasshopperRhinoScriptInput = {
    inputId: 'placement',
    variableName: 'brepiaPlacement',
    nickname: 'Plane',
    kind: 'placement',
    instanceGuid: await stableGuid([
      contract.model.projectId,
      'script-input',
      'placement',
    ]),
    sourceObjectGuid: null,
    converterType: 'System.Object',
    typeHintGuid: BREP_GRASSHOPPER_SCRIPT_OBJECT_HINT_GUID,
  };

  const outputDefinitions = [
    ['result', 'result', 'Result'],
    ['footprint', 'footprint', 'Footprint'],
    ['clearanceEnvelope', 'clearanceEnvelope', 'Clearance'],
    ['maintenanceEnvelope', 'maintenanceEnvelope', 'Maintenance'],
    ['connectionPoints', 'connectionPoints', 'Connections'],
    ['mountingPoints', 'mountingPoints', 'Mounting'],
    ['cablePoints', 'cablePoints', 'Cable'],
    ['metadata', 'metadata', 'Metadata'],
  ] as const;
  const outputs = await Promise.all(
    outputDefinitions.map(async ([outputId, variableName, nickname]) => ({
      outputId,
      variableName,
      nickname,
      instanceGuid: await stableGuid([
        contract.model.projectId,
        'script-output',
        outputId,
      ]),
    })),
  );

  const source = buildSource(contract, box, variables);
  return {
    kind: 'brepia-rhino-python3-script-plan',
    schemaVersion: 1,
    projectId: contract.model.projectId,
    sourceRevisionId: contract.model.sourceRevisionId,
    componentInstanceGuid: packagePlan.component.instanceGuid,
    componentNickname: contract.model.projectName,
    inputs: [...numberInputs, placementInput],
    outputs,
    source,
    sourceSha256: await sha256Hex(source),
  };
}
