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

export const BREP_GRASSHOPPER_RHINO_CSHARP_COMPONENT_GUID =
  'b6ba1144-02d6-4a2d-b53c-ec62e290eeb7';
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
  kind: 'brepia-rhino-csharp-script-plan';
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

function csharpNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new BrepGrasshopperRhinoScriptError(
      'invalid_model',
      'Rhino script numeric literals must be finite.',
    );
  }
  const normalized = Object.is(value, -0) ? 0 : value;
  return `${String(normalized)}d`;
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
  if (typeof value === 'number') return csharpNumber(value);
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
  return `new ${type}(${value
    .map((entry) => scalarExpression(entry, variables))
    .join(', ')})`;
}

function csharpString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}"`;
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
  return `TransformPoint(${position}, brepiaTransform)`;
}

function pointsForKind(
  contract: BrepGrasshopperContract,
  kind: BrepProjectObjectPoint['kind'],
  variables: ReadonlyMap<string, string>,
): string {
  const points = (contract.source.projectObject?.points ?? []).filter(
    (point) => point.kind === kind,
  );
  if (points.length === 0) return 'new List<Point3d>()';
  return `new List<Point3d> { ${points
    .map((point) => pointConstruction(point, variables))
    .join(', ')} }`;
}

function roleExpression(
  nodeId: string | undefined,
  resultNodeId: string,
): string {
  if (!nodeId) return 'null';
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

  const numericArguments = contract.source.parameters
    .map((parameter) => `double ${variables.get(parameter.id)}`)
    .join(', ');
  const argumentsPrefix = numericArguments.length > 0 ? `${numericArguments}, ` : '';

  return `// Brepia Rhino C# script v1\n// projectId: ${contract.model.projectId}\n// sourceRevisionId: ${contract.model.sourceRevisionId}\nusing System;\nusing System.Collections.Generic;\nusing Rhino.Geometry;\nusing Grasshopper.Kernel;\n\npublic class Script_Instance : GH_ScriptInstance\n{\n  private void RunScript(${argumentsPrefix}object brepiaPlacement, ref object result, ref object footprint, ref object clearanceEnvelope, ref object maintenanceEnvelope, ref object connectionPoints, ref object mountingPoints, ref object cablePoints, ref object metadata)\n  {\n    var brepiaWidth = ${width};\n    var brepiaDepth = ${depth};\n    var brepiaHeight = ${height};\n    if (!(brepiaWidth > 0d) || !(brepiaDepth > 0d) || !(brepiaHeight > 0d))\n      throw new ArgumentOutOfRangeException(\"Brepia box dimensions must be greater than zero.\");\n\n    var brepiaLocal = new Box(\n      Plane.WorldXY,\n      new Interval(-brepiaWidth / 2d, brepiaWidth / 2d),\n      new Interval(-brepiaDepth / 2d, brepiaDepth / 2d),\n      new Interval(0d, brepiaHeight)).ToBrep();\n\n    var brepiaDefaultPlane = NormalizePlane(new Plane(${defaultOrigin}, ${defaultXAxis}, ${defaultYAxis}));\n    var brepiaTargetPlane = brepiaPlacement is Plane suppliedPlane\n      ? NormalizePlane(suppliedPlane)\n      : brepiaDefaultPlane;\n    var brepiaTransform = Transform.PlaneToPlane(Plane.WorldXY, brepiaTargetPlane);\n    if (!brepiaLocal.Transform(brepiaTransform))\n      throw new InvalidOperationException(\"Rhino could not apply Brepia placement.\");\n\n    var brepiaResult = brepiaLocal;\n    result = brepiaResult;\n    footprint = ${footprint};\n    clearanceEnvelope = ${clearance};\n    maintenanceEnvelope = ${maintenance};\n    connectionPoints = ${connections};\n    mountingPoints = ${mounting};\n    cablePoints = ${cable};\n    metadata = ${csharpString(metadataEnvelope)};\n  }\n\n  private static Plane NormalizePlane(Plane source)\n  {\n    if (!source.IsValid) throw new ArgumentException(\"Brepia target Plane is invalid.\");\n    var x = source.XAxis;\n    var y = source.YAxis;\n    if (!x.Unitize()) throw new ArgumentException(\"Brepia target Plane X axis is invalid.\");\n    y -= Vector3d.Multiply(y, x) * x;\n    if (!y.Unitize()) throw new ArgumentException(\"Brepia target Plane axes are collinear.\");\n    var normalized = new Plane(source.Origin, x, y);\n    if (!normalized.IsValid) throw new ArgumentException(\"Brepia target Plane could not be normalized.\");\n    return normalized;\n  }\n\n  private static Point3d TransformPoint(Point3d point, Transform transform)\n  {\n    point.Transform(transform);\n    return point;\n  }\n}\n`;
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
    kind: 'brepia-rhino-csharp-script-plan',
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
