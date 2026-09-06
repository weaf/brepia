import {
  normalizeBrepGrasshopperContract,
  type BrepGrasshopperContract,
  type BrepGrasshopperNumberInput,
} from './brepGrasshopperContract.ts';

export const BREP_GRASSHOPPER_PACKAGE_PLAN_KIND =
  'brepia-grasshopper-package-plan' as const;
export const BREP_GRASSHOPPER_PACKAGE_PLAN_SCHEMA_VERSION = 1 as const;

const CONTROL_X = 40;
const CONTROL_Y = 80;
const CONTROL_Y_STEP = 70;
const COMPONENT_X = 420;
const CONTROL_WIDTH = 280;
const CONTROL_HEIGHT = 28;
const INSTANCE_GUID_NAMESPACE = 'brepia-grasshopper-package-plan-v1';

export type BrepGrasshopperCanvasPoint = {
  x: number;
  y: number;
};

export type BrepGrasshopperCanvasBounds = BrepGrasshopperCanvasPoint & {
  width: number;
  height: number;
};

export type BrepGrasshopperNumberControlPlan = {
  kind: 'number-control';
  instanceGuid: string;
  inputId: string;
  label: string;
  unit: BrepGrasshopperNumberInput['unit'];
  default: number;
  min?: number;
  max?: number;
  step?: number;
  presentation: 'slider' | 'number';
  bounds: BrepGrasshopperCanvasBounds;
};

export type BrepGrasshopperProjectComponentPlan = {
  kind: 'brepia-project';
  instanceGuid: string;
  nickname: string;
  pivot: BrepGrasshopperCanvasPoint;
  contractRef: 'root-contract';
};

export type BrepGrasshopperConnectionPlan = {
  kind: 'wire';
  from: {
    objectGuid: string;
    output: 'value';
  };
  to: {
    objectGuid: string;
    inputId: string;
  };
};

export type BrepGrasshopperPackagePlan = {
  kind: typeof BREP_GRASSHOPPER_PACKAGE_PLAN_KIND;
  schemaVersion: typeof BREP_GRASSHOPPER_PACKAGE_PLAN_SCHEMA_VERSION;
  model: BrepGrasshopperContract['model'];
  contract: BrepGrasshopperContract;
  component: BrepGrasshopperProjectComponentPlan;
  controls: BrepGrasshopperNumberControlPlan[];
  connections: BrepGrasshopperConnectionPlan[];
  placement: {
    inputId: 'placement';
    generatedSource: null;
    behavior: 'leave-unconnected-for-project-placement';
  };
};

function finiteNumber(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) ? value : undefined;
}

function presentationForInput(
  input: BrepGrasshopperNumberInput,
): 'slider' | 'number' {
  const min = finiteNumber(input.min);
  const max = finiteNumber(input.max);
  return min != null && max != null && min < max ? 'slider' : 'number';
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
  const segments = [INSTANCE_GUID_NAMESPACE, ...parts].map((part) =>
    encoder.encode(part),
  );
  const byteLength = segments.reduce((total, segment) => total + 4 + segment.length, 0);
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

async function stableInstanceGuid(parts: string[]): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', encodeStableSegments(parts)),
  );
  const uuid = digest.slice(0, 16);

  // RFC 9562 UUIDv8: deterministic application-defined payload with RFC variant.
  uuid[6] = ((uuid[6] ?? 0) & 0x0f) | 0x80;
  uuid[8] = ((uuid[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(uuid);
}

export async function createBrepGrasshopperPackagePlan(
  value: unknown,
): Promise<BrepGrasshopperPackagePlan> {
  const contract = normalizeBrepGrasshopperContract(value);

  // Grasshopper object identity intentionally survives Brepia revisions. The
  // immutable sourceRevisionId remains provenance in the embedded contract;
  // project/parameter identity is what lets later exports and reconciliation
  // recognize the same Brepia-owned object and its stable inputs.
  const identity = [contract.model.projectId];
  const componentGuid = await stableInstanceGuid([...identity, 'brepia-project']);
  const numberInputs = contract.interface.inputs.filter(
    (input): input is BrepGrasshopperNumberInput => input.type === 'number',
  );

  const controls = await Promise.all(
    numberInputs.map(async (input, index): Promise<BrepGrasshopperNumberControlPlan> => ({
      kind: 'number-control',
      instanceGuid: await stableInstanceGuid([
        ...identity,
        'number-control',
        input.id,
      ]),
      inputId: input.id,
      label: input.label,
      unit: input.unit,
      default: input.default,
      ...(input.min != null ? { min: input.min } : {}),
      ...(input.max != null ? { max: input.max } : {}),
      ...(input.step != null ? { step: input.step } : {}),
      presentation: presentationForInput(input),
      bounds: {
        x: CONTROL_X,
        y: CONTROL_Y + index * CONTROL_Y_STEP,
        width: CONTROL_WIDTH,
        height: CONTROL_HEIGHT,
      },
    })),
  );

  const componentY =
    controls.length > 0
      ? CONTROL_Y + ((controls.length - 1) * CONTROL_Y_STEP) / 2
      : CONTROL_Y;

  return {
    kind: BREP_GRASSHOPPER_PACKAGE_PLAN_KIND,
    schemaVersion: BREP_GRASSHOPPER_PACKAGE_PLAN_SCHEMA_VERSION,
    model: { ...contract.model },
    contract,
    component: {
      kind: 'brepia-project',
      instanceGuid: componentGuid,
      nickname: contract.model.projectName,
      pivot: {
        x: COMPONENT_X,
        y: componentY,
      },
      contractRef: 'root-contract',
    },
    controls,
    connections: controls.map((control) => ({
      kind: 'wire',
      from: {
        objectGuid: control.instanceGuid,
        output: 'value',
      },
      to: {
        objectGuid: componentGuid,
        inputId: control.inputId,
      },
    })),
    placement: {
      inputId: 'placement',
      generatedSource: null,
      behavior: 'leave-unconnected-for-project-placement',
    },
  };
}

export async function serializeBrepGrasshopperPackagePlan(
  value: unknown,
): Promise<string> {
  return `${JSON.stringify(await createBrepGrasshopperPackagePlan(value), null, 2)}\n`;
}
