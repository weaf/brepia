import {
  normalizeBrepGrasshopperContract,
  type BrepGrasshopperContract,
} from './brepGrasshopperContract.ts';
import { createBrepGrasshopperPackagePlan } from './brepGrasshopperPackagePlan.ts';
import type {
  BrepNode,
  BrepProjectObjectPoint,
  BrepScalar,
  BrepVector3,
} from './brepProject.ts';
import { isBrepParameterReference } from './brepScalar.ts';

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
const PYTHON_RESERVED_PORT_NAMES = new Set([
  'Result',
  'Footprint',
  'Clearance',
  'Maintenance',
  'Connections',
  'Mounting',
  'Cable',
  'Metadata',
]);

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

function pythonPortName(
  inputId: string,
  index: number,
  used: Set<string>,
): string {
  const words = inputId
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let base = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('');
  if (!base) base = `Param${index + 1}`;
  if (/^[0-9]/.test(base)) base = `Param${base}`;
  if (PYTHON_RESERVED_PORT_NAMES.has(base)) base = `Param${base}`;

  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function parameterVariables(contract: BrepGrasshopperContract): Map<string, string> {
  const used = new Set(PYTHON_RESERVED_PORT_NAMES);
  return new Map(
    contract.source.parameters.map((parameter, index) => [
      parameter.id,
      pythonPortName(parameter.id, index, used),
    ]),
  );
}

function scalarExpression(
  value: BrepScalar,
  variables: ReadonlyMap<string, string>,
): string {
  if (typeof value === 'number') return pythonNumber(value);
  if (isBrepParameterReference(value)) {
    const variable = variables.get(value.parameter);
    if (!variable) {
      throw new BrepGrasshopperRhinoScriptError(
        'invalid_model',
        `Unknown parameter reference ${value.parameter} in Rhino script generation.`,
      );
    }
    return `brepia_scalar(${variable})`;
  }

  const left = scalarExpression(value.args[0], variables);
  if (value.op === 'neg') return `brepia_neg(${left})`;
  const right = scalarExpression(value.args[1], variables);
  return `brepia_${value.op}(${left}, ${right})`;
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

function isLiteralZero(value: BrepScalar): boolean {
  return typeof value === 'number' && value === 0;
}

function filletAxisExpression(axis: 'x' | 'y' | 'z'): string {
  if (axis === 'x') return 'rg.Vector3d(1, 0, 0)';
  if (axis === 'y') return 'rg.Vector3d(0, 1, 0)';
  return 'rg.Vector3d(0, 0, 1)';
}

function assertSupportedRhinoContract(contract: BrepGrasshopperContract): void {
  if (contract.source.nodes.length === 0) {
    throw new BrepGrasshopperRhinoScriptError(
      'unsupported_model',
      'Rhino script generation requires at least one canonical BRep node.',
    );
  }

  for (const node of contract.source.nodes) {
    if (
      node.type === 'transform' &&
      node.rotateDeg != null &&
      node.rotateDeg.some((entry) => !isLiteralZero(entry))
    ) {
      throw new BrepGrasshopperRhinoScriptError(
        'unsupported_model',
        `Rhino GHX host generation does not yet support non-zero transform rotation on node ${node.id}.`,
      );
    }
  }
}

type RhinoGraphSource = {
  source: string;
  nodeVariables: Map<string, string>;
};

function buildGraphSource(
  contract: BrepGrasshopperContract,
  variables: ReadonlyMap<string, string>,
): RhinoGraphSource {
  const entries = new Map<string, { node: BrepNode; index: number }>(
    contract.source.nodes.map((node, index) => [node.id, { node, index }]),
  );
  const nodeVariables = new Map(
    contract.source.nodes.map((node, index) => [node.id, `brepiaNode${index}`]),
  );
  const emitted = new Set<string>();
  const visiting = new Set<string>();
  const lines: string[] = [];

  const emitNode = (nodeId: string): string => {
    const entry = entries.get(nodeId);
    const variable = nodeVariables.get(nodeId);
    if (!entry || !variable) {
      throw new BrepGrasshopperRhinoScriptError(
        'invalid_model',
        `Rhino script generation cannot resolve canonical node ${nodeId}.`,
      );
    }
    if (emitted.has(nodeId)) return variable;
    if (visiting.has(nodeId)) {
      throw new BrepGrasshopperRhinoScriptError(
        'invalid_model',
        `Rhino script generation encountered a cycle at node ${nodeId}.`,
      );
    }
    visiting.add(nodeId);

    const node = entry.node;
    if (node.type === 'box') {
      const width = scalarExpression(node.width, variables);
      const depth = scalarExpression(node.depth, variables);
      const height = scalarExpression(node.height, variables);
      lines.push(`${variable}Width = float(${width})`);
      lines.push(`${variable}Depth = float(${depth})`);
      lines.push(`${variable}Height = float(${height})`);
      lines.push(
        `if ${variable}Width <= 0.0 or ${variable}Depth <= 0.0 or ${variable}Height <= 0.0:`,
      );
      lines.push(
        `    raise ValueError(${pythonString(`Brepia box node ${node.id} dimensions must be greater than zero.`)})`,
      );
      lines.push(`${variable} = rg.Box(`);
      lines.push('    rg.Plane.WorldXY,');
      lines.push(
        `    rg.Interval(-${variable}Width / 2.0, ${variable}Width / 2.0),`,
      );
      lines.push(
        `    rg.Interval(-${variable}Depth / 2.0, ${variable}Depth / 2.0),`,
      );
      lines.push(
        `    rg.Interval(-${variable}Height / 2.0, ${variable}Height / 2.0),`,
      );
      lines.push(').ToBrep()');
    } else if (node.type === 'cylinder') {
      const radius = scalarExpression(node.radius, variables);
      const height = scalarExpression(node.height, variables);
      lines.push(`${variable}Radius = float(${radius})`);
      lines.push(`${variable}Height = float(${height})`);
      lines.push(`if ${variable}Radius <= 0.0 or ${variable}Height <= 0.0:`);
      lines.push(
        `    raise ValueError(${pythonString(`Brepia cylinder node ${node.id} dimensions must be greater than zero.`)})`,
      );
      lines.push(
        `${variable}Cylinder = rg.Cylinder(rg.Circle(rg.Plane.WorldXY, ${variable}Radius), ${variable}Height)`,
      );
      lines.push(`${variable} = ${variable}Cylinder.ToBrep(True, True)`);
      lines.push(`if ${variable} is None:`);
      lines.push(
        `    raise RuntimeError(${pythonString(`Rhino could not create Brepia cylinder node ${node.id}.`)})`,
      );
      lines.push(
        `if not ${variable}.Transform(rg.Transform.Translation(rg.Vector3d(0, 0, -${variable}Height / 2.0))):`,
      );
      lines.push(
        `    raise RuntimeError(${pythonString(`Rhino could not center Brepia cylinder node ${node.id}.`)})`,
      );
    } else if (node.type === 'transform') {
      const input = emitNode(node.input);
      const translate = vectorExpression(
        node.translate ?? [0, 0, 0],
        variables,
        'vector',
      );
      lines.push(`${variable} = ${input}.DuplicateBrep()`);
      lines.push(`if not ${variable}.Transform(rg.Transform.Translation(${translate})):`);
      lines.push(
        `    raise RuntimeError(${pythonString(`Rhino could not translate Brepia node ${node.id}.`)})`,
      );
    } else if (node.type === 'subtract') {
      const base = emitNode(node.base);
      lines.push(`${variable} = ${base}.DuplicateBrep()`);
      node.tools.forEach((toolId, toolIndex) => {
        const tool = emitNode(toolId);
        const parts = `${variable}Parts${toolIndex}`;
        lines.push(
          `${parts} = rg.Brep.CreateBooleanDifference(${variable}, ${tool}, brepiaTolerance)`,
        );
        lines.push(`if ${parts} is None or len(${parts}) != 1:`);
        lines.push(
          `    raise RuntimeError(${pythonString(`Rhino boolean difference for Brepia node ${node.id} did not produce exactly one Brep.`)})`,
        );
        lines.push(`${variable} = ${parts}[0]`);
      });
    } else if (node.type === 'fillet') {
      const input = emitNode(node.input);
      const radius = scalarExpression(node.radius, variables);
      const edge = `${variable}Edge`;
      const edgeParameter = `${variable}EdgeParameter`;
      const edgeDirection = `${variable}EdgeDirection`;
      const edgeDot = `${variable}EdgeDot`;

      lines.push('from System import Array, Double, Int32');
      lines.push(`${variable}Input = ${input}.DuplicateBrep()`);
      lines.push(`${variable}Radius = float(${radius})`);
      lines.push(`if ${variable}Radius <= 0.0:`);
      lines.push(
        `    raise ValueError(${pythonString(`Brepia fillet node ${node.id} radius must be greater than zero.`)})`,
      );
      lines.push(`${variable}EdgeIndices = []`);
      lines.push(`${variable}Axis = ${filletAxisExpression(node.selector.axis)}`);
      lines.push(`for ${edge} in ${variable}Input.Edges:`);
      lines.push(`    ${edgeParameter} = ${edge}.Domain.ParameterAt(0.5)`);
      lines.push(`    ${edgeDirection} = ${edge}.TangentAt(${edgeParameter})`);
      lines.push(`    if not ${edgeDirection}.Unitize():`);
      lines.push('        continue');
      lines.push(
        `    ${edgeDot} = (${edgeDirection}.X * ${variable}Axis.X + ${edgeDirection}.Y * ${variable}Axis.Y + ${edgeDirection}.Z * ${variable}Axis.Z)`,
      );
      lines.push(`    if abs(abs(${edgeDot}) - 1.0) <= 1e-3:`);
      lines.push(`        ${variable}EdgeIndices.append(${edge}.EdgeIndex)`);
      lines.push(`if len(${variable}EdgeIndices) == 0:`);
      lines.push(
        `    raise ValueError(${pythonString(`Brepia fillet selector for node ${node.id} matched no edges.`)})`,
      );
      lines.push(
        `${variable}EdgeArray = Array[Int32](${variable}EdgeIndices)`,
      );
      lines.push(
        `${variable}Radii = Array[Double]([${variable}Radius] * len(${variable}EdgeIndices))`,
      );
      lines.push(`${variable}Parts = rg.Brep.CreateFilletEdges(`);
      lines.push(`    ${variable}Input,`);
      lines.push(`    ${variable}EdgeArray,`);
      lines.push(`    ${variable}Radii,`);
      lines.push(`    ${variable}Radii,`);
      lines.push('    rg.BlendType.Fillet,');
      lines.push('    rg.RailType.RollingBall,');
      lines.push('    brepiaTolerance,');
      lines.push(')');
      lines.push(`if ${variable}Parts is None or len(${variable}Parts) != 1:`);
      lines.push(
        `    raise RuntimeError(${pythonString(`Rhino fillet for Brepia node ${node.id} did not produce exactly one Brep.`)})`,
      );
      lines.push(`${variable} = ${variable}Parts[0]`);
    }

    visiting.delete(nodeId);
    emitted.add(nodeId);
    return variable;
  };

  for (const node of contract.source.nodes) emitNode(node.id);

  return {
    source: lines.join('\n'),
    nodeVariables,
  };
}

function roleExpression(
  nodeId: string | undefined,
  nodeVariables: ReadonlyMap<string, string>,
): string {
  if (!nodeId) return 'None';
  const variable = nodeVariables.get(nodeId);
  if (!variable) {
    throw new BrepGrasshopperRhinoScriptError(
      'invalid_model',
      `Rhino script generation cannot resolve project-object role node ${nodeId}.`,
    );
  }
  return `brepia_place_brep(${variable}, brepiaTransform)`;
}

function buildSource(
  contract: BrepGrasshopperContract,
  variables: ReadonlyMap<string, string>,
): string {
  const graph = buildGraphSource(contract, variables);
  const resultVariable = graph.nodeVariables.get(contract.source.resultNodeId);
  if (!resultVariable) {
    throw new BrepGrasshopperRhinoScriptError(
      'invalid_model',
      `Rhino script generation cannot resolve result node ${contract.source.resultNodeId}.`,
    );
  }

  const placement = contract.source.placement;
  const defaultOrigin = vectorExpression(placement.origin, variables, 'point');
  const defaultXAxis = vectorExpression(placement.xAxis, variables, 'vector');
  const defaultYAxis = vectorExpression(placement.yAxis, variables, 'vector');
  const definition = contract.source.projectObject;
  const footprint = roleExpression(definition?.footprintNodeId, graph.nodeVariables);
  const clearance = roleExpression(
    definition?.clearanceEnvelopeNodeId,
    graph.nodeVariables,
  );
  const maintenance = roleExpression(
    definition?.maintenanceEnvelopeNodeId,
    graph.nodeVariables,
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

  return `# Brepia Rhino Python 3 script v1\n# projectId: ${contract.model.projectId}\n# sourceRevisionId: ${contract.model.sourceRevisionId}\nimport math\nimport Rhino\nimport Rhino.Geometry as rg\n\ndef brepia_scalar(value):\n    value = float(value)\n    if not math.isfinite(value) or abs(value) > 1000000000.0:\n        raise ValueError("Brepia scalar value must be finite and bounded.")\n    return 0.0 if value == 0.0 else value\n\ndef brepia_add(left, right):\n    return brepia_scalar(brepia_scalar(left) + brepia_scalar(right))\n\ndef brepia_sub(left, right):\n    return brepia_scalar(brepia_scalar(left) - brepia_scalar(right))\n\ndef brepia_mul(left, right):\n    return brepia_scalar(brepia_scalar(left) * brepia_scalar(right))\n\ndef brepia_div(left, right):\n    left = brepia_scalar(left)\n    right = brepia_scalar(right)\n    if right == 0.0:\n        raise ValueError("Brepia scalar expression divides by zero.")\n    return brepia_scalar(left / right)\n\ndef brepia_neg(value):\n    return brepia_scalar(-brepia_scalar(value))\n\ndef brepia_normalize_plane(source):\n    if source is None or not source.IsValid:\n        raise ValueError("Brepia project placement plane is invalid.")\n    return source\n\ndef brepia_transform_point(point, transform):\n    point.Transform(transform)\n    return point\n\ndef brepia_place_brep(source, transform):\n    placed = source.DuplicateBrep()\n    if not placed.Transform(transform):\n        raise RuntimeError("Rhino could not apply Brepia project placement.")\n    return placed\n\nbrepiaDoc = Rhino.RhinoDoc.ActiveDoc\nbrepiaTolerance = brepiaDoc.ModelAbsoluteTolerance if brepiaDoc is not None else 0.01\n\n${graph.source}\n\nbrepiaDefaultPlane = brepia_normalize_plane(\n    rg.Plane(${defaultOrigin}, ${defaultXAxis}, ${defaultYAxis})\n)\nbrepiaTransform = rg.Transform.PlaneToPlane(rg.Plane.WorldXY, brepiaDefaultPlane)\n\nResult = brepia_place_brep(${resultVariable}, brepiaTransform)\nFootprint = ${footprint}\nClearance = ${clearance}\nMaintenance = ${maintenance}\nConnections = ${connections}\nMounting = ${mounting}\nCable = ${cable}\nMetadata = ${pythonString(metadataEnvelope)}\n`;
}

export async function createBrepGrasshopperRhinoScriptPlan(
  value: unknown,
): Promise<BrepGrasshopperRhinoScriptPlan> {
  const contract = normalizeBrepGrasshopperContract(value);
  assertSupportedRhinoContract(contract);
  const packagePlan = await createBrepGrasshopperPackagePlan(contract);
  const variables = parameterVariables(contract);

  const numberInputs = await Promise.all(
    packagePlan.controls.map(async (control): Promise<BrepGrasshopperRhinoScriptInput> => {
      const variableName = variables.get(control.inputId);
      if (!variableName) {
        throw new BrepGrasshopperRhinoScriptError(
          'invalid_model',
          `Published Grasshopper input ${control.inputId} has no canonical Python variable.`,
        );
      }
      return {
        inputId: control.inputId,
        variableName,
        nickname: variableName,
        kind: 'number',
        instanceGuid: await stableGuid([
          contract.model.projectId,
          'script-input',
          control.inputId,
        ]),
        sourceObjectGuid: control.instanceGuid,
        converterType: 'System.Double',
        typeHintGuid: BREP_GRASSHOPPER_SCRIPT_DOUBLE_HINT_GUID,
      };
    }),
  );

  const outputDefinitions = [
    ['result', 'Result'],
    ['footprint', 'Footprint'],
    ['clearanceEnvelope', 'Clearance'],
    ['maintenanceEnvelope', 'Maintenance'],
    ['connectionPoints', 'Connections'],
    ['mountingPoints', 'Mounting'],
    ['cablePoints', 'Cable'],
    ['metadata', 'Metadata'],
  ] as const;
  const outputs = await Promise.all(
    outputDefinitions.map(async ([outputId, portName]) => ({
      outputId,
      variableName: portName,
      nickname: portName,
      instanceGuid: await stableGuid([
        contract.model.projectId,
        'script-output',
        outputId,
      ]),
    })),
  );

  const source = buildSource(contract, variables);
  return {
    kind: 'brepia-rhino-python3-script-plan',
    schemaVersion: 1,
    projectId: contract.model.projectId,
    sourceRevisionId: contract.model.sourceRevisionId,
    componentInstanceGuid: packagePlan.component.instanceGuid,
    componentNickname: contract.model.projectName,
    inputs: numberInputs,
    outputs,
    source,
    sourceSha256: await sha256Hex(source),
  };
}
