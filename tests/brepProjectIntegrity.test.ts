import { describe, expect, it } from 'vitest';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from '../shared/brepProject';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity';

function classificationFixture(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'integrityFixture',
    name: 'Integrity fixture',
    units: 'mm',
    placement: {
      origin: [{ parameter: 'semanticOffset' }, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    projectObject: {
      footprintNodeId: 'footprint',
      points: [
        {
          id: 'connection',
          kind: 'connection',
          position: [{ parameter: 'mixedOrphanSemantic' }, 0, 0],
        },
      ],
    },
    parameters: [
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 100,
      },
      {
        id: 'footprintWidth',
        label: 'Footprint width',
        type: 'number',
        unit: 'mm',
        default: 120,
      },
      {
        id: 'semanticOffset',
        label: 'Semantic offset',
        type: 'number',
        unit: 'mm',
        default: 10,
      },
      {
        id: 'orphanRadius',
        label: 'Orphan radius',
        type: 'number',
        unit: 'mm',
        default: 5,
      },
      {
        id: 'mixedOrphanSemantic',
        label: 'Mixed orphan semantic',
        type: 'number',
        unit: 'mm',
        default: 20,
      },
      {
        id: 'unused',
        label: 'Unused',
        type: 'number',
        unit: 'mm',
        default: 1,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'box',
        width: { parameter: 'width' },
        depth: 50,
        height: 40,
      },
      {
        id: 'footprint',
        type: 'box',
        width: { parameter: 'footprintWidth' },
        depth: 60,
        height: 1,
      },
      {
        id: 'orphanCylinder',
        type: 'cylinder',
        radius: { parameter: 'orphanRadius' },
        height: { parameter: 'mixedOrphanSemantic' },
      },
    ],
    resultNodeId: 'body',
  };
}

function roomPattern(): BrepProject {
  const parameter = (id: string, value: number) => ({
    id,
    label: id,
    type: 'number' as const,
    unit: 'mm' as const,
    default: value,
  });
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'roomPattern',
    name: 'Room pattern',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      parameter('room_width', 5000),
      parameter('room_depth', 4000),
      parameter('room_height', 2800),
      parameter('door_width', 900),
      parameter('door_offset', 400),
      parameter('cabinet_gap', 50),
      parameter('cabinet_height', 2000),
      parameter('cabinet_width', 600),
      parameter('door_height', 2100),
      parameter('wall_thickness', 100),
    ],
    nodes: [
      {
        id: 'room',
        type: 'box',
        width: { parameter: 'room_width' },
        depth: { parameter: 'room_depth' },
        height: { parameter: 'room_height' },
      },
      {
        id: 'door',
        type: 'box',
        width: { parameter: 'door_width' },
        depth: 5000,
        height: 3000,
      },
      {
        id: 'positionedDoor',
        type: 'transform',
        input: 'door',
        translate: [{ parameter: 'door_offset' }, 0, 0],
      },
      {
        id: 'roomWithDoor',
        type: 'subtract',
        base: 'room',
        tools: ['positionedDoor'],
      },
    ],
    resultNodeId: 'roomWithDoor',
  };
}

function platePattern(): BrepProject {
  const parameter = (id: string, value: number) => ({
    id,
    label: id,
    type: 'number' as const,
    unit: 'mm' as const,
    default: value,
  });
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'platePattern',
    name: 'Plate pattern',
    units: 'mm',
    placement: { origin: [0, 0, 0], xAxis: [1, 0, 0], yAxis: [0, 1, 0] },
    parameters: [
      parameter('plate_width', 200),
      parameter('hole_radius', 10),
      parameter('hole_offset', 40),
      parameter('fillet_radius', 5),
      parameter('hole_diameter', 20),
      parameter('parameter', 1),
      parameter('parameter2', 2),
    ],
    nodes: [
      {
        id: 'plate',
        type: 'box',
        width: { parameter: 'plate_width' },
        depth: 120,
        height: 10,
      },
      {
        id: 'hole',
        type: 'cylinder',
        radius: { parameter: 'hole_radius' },
        height: 20,
      },
      {
        id: 'positionedHole',
        type: 'transform',
        input: 'hole',
        translate: [{ parameter: 'hole_offset' }, 0, 0],
      },
      {
        id: 'plateWithHole',
        type: 'subtract',
        base: 'plate',
        tools: ['positionedHole'],
      },
      {
        id: 'filletedPlate',
        type: 'fillet',
        input: 'plateWithHole',
        radius: { parameter: 'fillet_radius' },
        selector: { kind: 'parallelToAxis', axis: 'z' },
      },
    ],
    resultNodeId: 'plateWithHole',
  };
}

describe('BRep project integrity analysis', () => {
  it('classifies result/role reachability, orphan nodes and parameter effectiveness deterministically', () => {
    const analysis = analyzeBrepProjectIntegrity(classificationFixture());

    expect(analysis.resultReachableNodeIds).toEqual(['body']);
    expect(analysis.roleReachableNodeIds).toEqual(['footprint']);
    expect(analysis.authoritativeReachableNodeIds).toEqual(['body', 'footprint']);
    expect(analysis.orphanNodeIds).toEqual(['orphanCylinder']);
    expect(analysis.effectiveParameterIds).toEqual(['footprintWidth', 'width']);
    expect(analysis.semanticOnlyParameterIds).toEqual(['semanticOffset']);
    expect(analysis.orphanOnlyParameterIds).toEqual([
      'mixedOrphanSemantic',
      'orphanRadius',
    ]);
    expect(analysis.unusedParameterIds).toEqual(['unused']);
    expect(analysis.parameterClassifications).toEqual({
      footprintWidth: 'effective',
      mixedOrphanSemantic: 'orphan-only',
      orphanRadius: 'orphan-only',
      semanticOffset: 'semantic-only',
      unused: 'unused',
      width: 'effective',
    });
  });

  it('detects the audited room failure pattern of five disconnected published parameters', () => {
    const analysis = analyzeBrepProjectIntegrity(roomPattern());

    expect(analysis.orphanNodeIds).toEqual([]);
    expect(analysis.effectiveParameterIds).toEqual([
      'door_offset',
      'door_width',
      'room_depth',
      'room_height',
      'room_width',
    ]);
    expect(analysis.unusedParameterIds).toEqual([
      'cabinet_gap',
      'cabinet_height',
      'cabinet_width',
      'door_height',
      'wall_thickness',
    ]);
  });

  it('detects the audited plate failure pattern of an orphan fillet and fake controls', () => {
    const analysis = analyzeBrepProjectIntegrity(platePattern());

    expect(analysis.orphanNodeIds).toEqual(['filletedPlate']);
    expect(analysis.orphanOnlyParameterIds).toEqual(['fillet_radius']);
    expect(analysis.unusedParameterIds).toEqual([
      'hole_diameter',
      'parameter',
      'parameter2',
    ]);
    expect(analysis.effectiveParameterIds).toEqual([
      'hole_offset',
      'hole_radius',
      'plate_width',
    ]);
  });
});
