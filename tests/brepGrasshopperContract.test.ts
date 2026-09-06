import { describe, expect, it } from 'vitest';
import {
  BREP_GRASSHOPPER_CONTRACT_MAX_BYTES,
  BrepGrasshopperContractError,
  createBrepGrasshopperContract,
  normalizeBrepGrasshopperContract,
  parseBrepGrasshopperContractJson,
  serializeBrepGrasshopperContract,
} from '@shared/brepGrasshopperContract';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from '@shared/brepProject';

function project(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'cabinetA42',
    name: 'Cabinet A42',
    units: 'mm',
    placement: {
      origin: [{ parameter: 'width' }, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    metadata: {
      objectType: 'cabinet',
      classification: 'equipment',
      properties: { system: 'traction' },
    },
    parameters: [
      {
        id: 'width',
        label: 'Cabinet width',
        type: 'number',
        unit: 'mm',
        default: 1200,
        min: 600,
        max: 2400,
        step: 50,
        description: 'Overall cabinet width.',
      },
      {
        id: 'rotation',
        label: 'Rotation',
        type: 'number',
        unit: 'deg',
        default: 0,
      },
      {
        id: 'scaleHint',
        label: 'Scale hint',
        type: 'number',
        unit: 'none',
        default: 1,
      },
      {
        id: 'height',
        label: 'Cabinet height',
        type: 'number',
        unit: 'mm',
        default: 2100,
        min: 1000,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'box',
        width: { parameter: 'width' },
        depth: 500,
        height: { parameter: 'height' },
      },
      {
        id: 'clearance',
        type: 'box',
        width: 1800,
        depth: 900,
        height: 2400,
      },
    ],
    resultNodeId: 'body',
    projectObject: {
      footprintNodeId: 'body',
      clearanceEnvelopeNodeId: 'clearance',
      points: [
        {
          id: 'cableEntry',
          kind: 'cable',
          label: 'Cable entry',
          position: [{ parameter: 'width' }, 100, 0],
          direction: [0, 0, 1],
        },
      ],
    },
  };
}

function expectContractError(
  action: () => unknown,
  code: BrepGrasshopperContractError['code'],
) {
  expect(action).toThrowError(
    expect.objectContaining({
      name: 'BrepGrasshopperContractError',
      code,
    }),
  );
}

describe('BRep Grasshopper export contract', () => {
  it('maps stable numeric parameter IDs and appends the standard placement Plane', () => {
    const contract = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: 'revision-42',
    });

    expect(contract.kind).toBe('brepia-grasshopper-contract');
    expect(contract.schemaVersion).toBe(1);
    expect(contract.model).toEqual({
      projectId: 'cabinetA42',
      projectName: 'Cabinet A42',
      projectSchemaVersion: 1,
      sourceRevisionId: 'revision-42',
    });

    expect(contract.interface.inputs.map((input) => input.id)).toEqual([
      'height',
      'rotation',
      'scaleHint',
      'width',
      'placement',
    ]);
    expect(contract.interface.inputs[0]).toMatchObject({
      id: 'height',
      label: 'Cabinet height',
      type: 'number',
      access: 'item',
      unit: 'mm',
      default: 2100,
      min: 1000,
      fallback: 'project-default',
    });
    expect(contract.interface.inputs[3]).toMatchObject({
      id: 'width',
      label: 'Cabinet width',
      unit: 'mm',
      min: 600,
      max: 2400,
      step: 50,
      description: 'Overall cabinet width.',
    });
    expect(contract.interface.inputs[4]).toMatchObject({
      id: 'placement',
      label: 'Plane',
      type: 'plane',
      access: 'item',
      fallback: 'project-placement',
    });
  });

  it('keeps the standard output port order independent of optional role presence', () => {
    const withRoles = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: 'revision-with-roles',
    });
    const withoutRolesProject = project();
    delete withoutRolesProject.projectObject;
    const withoutRoles = createBrepGrasshopperContract({
      project: withoutRolesProject,
      sourceRevisionId: 'revision-without-roles',
    });

    const expectedIds = [
      'result',
      'footprint',
      'clearanceEnvelope',
      'maintenanceEnvelope',
      'connectionPoints',
      'mountingPoints',
      'cablePoints',
      'metadata',
    ];
    expect(withRoles.interface.outputs.map((output) => output.id)).toEqual(
      expectedIds,
    );
    expect(withoutRoles.interface.outputs.map((output) => output.id)).toEqual(
      expectedIds,
    );
    expect(withRoles.interface.outputs[0]).toMatchObject({
      type: 'brep',
      optional: false,
      semantic: 'primary-result',
    });
    expect(withRoles.interface.outputs[1]).toMatchObject({
      type: 'brep',
      optional: true,
      semantic: 'footprint',
    });
    expect(withRoles.interface.outputs[6]).toMatchObject({
      type: 'semantic-point',
      access: 'list',
      pointKind: 'cable',
    });
  });

  it('preserves canonical project-object point identity and placement semantics in the snapshot contract', () => {
    const contract = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: 'revision-points',
    });

    expect(contract.source.projectObject?.points?.[0]).toEqual({
      id: 'cableEntry',
      kind: 'cable',
      label: 'Cable entry',
      position: [{ parameter: 'width' }, 100, 0],
      direction: [0, 0, 1],
    });
    expect(contract.placement).toEqual({
      inputId: 'placement',
      unconnected: 'resolved-project-placement',
      connected: 'replace-project-placement',
      sourceGeometrySpace: 'component-local',
      application: 'transform-all-project-outputs-to-target-plane',
      axisMeaning: 'orientation-only',
    });
    expect(contract.diagnostics).toEqual({
      mode: 'grasshopper-runtime-messages',
      warningSeverity: 'warning',
      errorSeverity: 'error',
    });
  });

  it('rebuilds stale derived interface data from canonical source instead of trusting it', () => {
    const canonical = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: 'revision-canonical',
    });
    const tampered = JSON.parse(JSON.stringify(canonical)) as Record<
      string,
      unknown
    >;
    tampered.interface = {
      inputs: [{ id: 'fake', type: 'string' }],
      outputs: [],
    };
    tampered.placement = { inputId: 'fake' };
    tampered.diagnostics = { mode: 'ignore-errors' };

    expect(normalizeBrepGrasshopperContract(tampered)).toEqual(canonical);
  });

  it('rejects model identity that does not match the embedded canonical source', () => {
    const contract = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: 'revision-good',
    });
    const tampered = JSON.parse(JSON.stringify(contract));
    tampered.model.projectId = 'differentProject';

    expectContractError(
      () => normalizeBrepGrasshopperContract(tampered),
      'invalid_contract',
    );
  });

  it('serializes and parses a deterministic bounded portable contract', () => {
    const contract = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: '  revision-roundtrip  ',
    });
    const text = serializeBrepGrasshopperContract(contract);
    expect(text.endsWith('\n')).toBe(true);
    expect(parseBrepGrasshopperContractJson(text)).toEqual({
      ...contract,
      model: { ...contract.model, sourceRevisionId: 'revision-roundtrip' },
    });
  });

  it('rejects unsupported versions and oversized JSON before parsing', () => {
    const contract = createBrepGrasshopperContract({
      project: project(),
      sourceRevisionId: 'revision-version',
    });
    const unsupported = { ...contract, schemaVersion: 2 };
    expectContractError(
      () => normalizeBrepGrasshopperContract(unsupported),
      'unsupported_version',
    );

    const oversized = ' '.repeat(BREP_GRASSHOPPER_CONTRACT_MAX_BYTES + 1);
    expectContractError(
      () => parseBrepGrasshopperContractJson(oversized),
      'too_large',
    );
  });
});
