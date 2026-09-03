import { describe, expect, it } from 'vitest';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
} from '../shared/brepProject';

function cabinetProject(): BrepProject {
  return {
    schemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    id: 'cabinetA42',
    name: 'Cabinet A42',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    metadata: {
      objectType: 'cabinet',
      classification: 'railway-equipment',
      properties: { manufacturer: 'Brepia', assetClass: 'A42' },
    },
    parameters: [
      {
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 1200,
        min: 600,
        max: 2400,
        step: 50,
      },
      {
        id: 'height',
        label: 'Height',
        type: 'number',
        unit: 'mm',
        default: 1800,
        min: 800,
        max: 3000,
        step: 50,
      },
      {
        id: 'holeOffset',
        label: 'Cable entry offset',
        type: 'number',
        unit: 'mm',
        default: 300,
      },
      {
        id: 'filletRadius',
        label: 'Edge radius',
        type: 'number',
        unit: 'mm',
        default: 20,
        min: 0,
      },
    ],
    nodes: [
      {
        id: 'cabinetBody',
        type: 'box',
        width: { parameter: 'width' },
        depth: 600,
        height: { parameter: 'height' },
      },
      {
        id: 'cableHole',
        type: 'cylinder',
        radius: 40,
        height: 600,
      },
      {
        id: 'positionedHole',
        type: 'transform',
        input: 'cableHole',
        translate: [{ parameter: 'holeOffset' }, 0, 100],
        rotateDeg: [90, 0, 0],
      },
      {
        id: 'cutBody',
        type: 'subtract',
        base: 'cabinetBody',
        tools: ['positionedHole'],
      },
      {
        id: 'finishedBody',
        type: 'fillet',
        input: 'cutBody',
        radius: { parameter: 'filletRadius' },
        selector: { kind: 'parallelToAxis', axis: 'z' },
      },
    ],
    resultNodeId: 'finishedBody',
  };
}

function expectBrepError(
  action: () => unknown,
  code: BrepProjectError['code'],
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BrepProjectError);
    expect((error as BrepProjectError).code).toBe(code);
    return;
  }
  throw new Error(`Expected BrepProjectError with code ${code}.`);
}

describe('normalizeBrepProject', () => {
  it('normalizes a parameterized BRep DAG with stable published parameter ids', () => {
    const project = cabinetProject();
    project.parameters.reverse();
    project.nodes.reverse();

    const normalized = normalizeBrepProject(project);

    expect(normalized.schemaVersion).toBe(1);
    expect(normalized.id).toBe('cabinetA42');
    expect(normalized.resultNodeId).toBe('finishedBody');
    expect(normalized.parameters.map((parameter) => parameter.id)).toEqual([
      'filletRadius',
      'height',
      'holeOffset',
      'width',
    ]);
    expect(normalized.nodes.map((node) => node.id)).toEqual([
      'cabinetBody',
      'cableHole',
      'cutBody',
      'finishedBody',
      'positionedHole',
    ]);
    expect(normalized.metadata?.properties).toEqual({
      assetClass: 'A42',
      manufacturer: 'Brepia',
    });
    expect(normalized.placement).toEqual(project.placement);
  });

  it('canonicalizes an omitted v1 placement to the world XY plane', () => {
    const project = cabinetProject() as Partial<BrepProject>;
    delete project.placement;

    expect(normalizeBrepProject(project).placement).toEqual({
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    });
  });

  it('rejects parameter references with a unit incompatible with their semantic field', () => {
    const project = cabinetProject();
    project.parameters.push({
      id: 'turn',
      label: 'Turn',
      type: 'number',
      unit: 'deg',
      default: 90,
    });
    const body = project.nodes.find((node) => node.id === 'cabinetBody');
    if (!body || body.type !== 'box') throw new Error('Fixture is invalid.');
    body.width = { parameter: 'turn' };

    expectBrepError(() => normalizeBrepProject(project), 'invalid_parameter');
  });

  it('rejects unbounded project metadata', () => {
    const project = cabinetProject() as unknown as {
      metadata: { properties: Record<string, string> };
    } & BrepProject;
    project.metadata.properties = Object.fromEntries(
      Array.from({ length: 65 }, (_, index) => [`key${index}`, 'value']),
    );

    expectBrepError(() => normalizeBrepProject(project), 'invalid_metadata');
  });

  it('rejects duplicate published parameter ids', () => {
    const project = cabinetProject();
    project.parameters.push({ ...project.parameters[0] });

    expectBrepError(() => normalizeBrepProject(project), 'duplicate_parameter');
  });

  it('rejects references to unknown published parameters', () => {
    const project = cabinetProject();
    const body = project.nodes.find((node) => node.id === 'cabinetBody');
    if (!body || body.type !== 'box') throw new Error('Fixture is invalid.');
    body.width = { parameter: 'missingWidth' };

    expectBrepError(() => normalizeBrepProject(project), 'invalid_reference');
  });

  it('rejects references to unknown feature nodes', () => {
    const project = cabinetProject();
    const cut = project.nodes.find((node) => node.id === 'cutBody');
    if (!cut || cut.type !== 'subtract') throw new Error('Fixture is invalid.');
    cut.tools = ['missingTool'];

    expectBrepError(() => normalizeBrepProject(project), 'invalid_reference');
  });

  it('rejects cyclic feature graphs', () => {
    const project = cabinetProject();
    const transform = project.nodes.find(
      (node) => node.id === 'positionedHole',
    );
    if (!transform || transform.type !== 'transform')
      throw new Error('Fixture is invalid.');
    transform.input = 'finishedBody';

    expectBrepError(() => normalizeBrepProject(project), 'cycle');
  });

  it('rejects a missing result feature', () => {
    const project = cabinetProject();
    project.resultNodeId = 'missingResult';

    expectBrepError(() => normalizeBrepProject(project), 'missing_result');
  });

  it('rejects invalid parameter ranges before they can become Grasshopper inputs', () => {
    const project = cabinetProject();
    const width = project.parameters.find(
      (parameter) => parameter.id === 'width',
    );
    if (!width) throw new Error('Fixture is invalid.');
    width.min = 1500;
    width.default = 1200;

    expectBrepError(() => normalizeBrepProject(project), 'invalid_parameter');
  });

  it('rejects transform nodes that do not perform a transform', () => {
    const project = cabinetProject();
    const transform = project.nodes.find(
      (node) => node.id === 'positionedHole',
    );
    if (!transform || transform.type !== 'transform')
      throw new Error('Fixture is invalid.');
    delete transform.translate;
    delete transform.rotateDeg;

    expectBrepError(() => normalizeBrepProject(project), 'invalid_node');
  });

  it('rejects unsupported edge selector semantics rather than guessing topology', () => {
    const project = cabinetProject() as unknown as {
      nodes: Array<Record<string, unknown>>;
    } & Omit<BrepProject, 'nodes'>;
    const fillet = project.nodes.find((node) => node.id === 'finishedBody');
    if (!fillet) throw new Error('Fixture is invalid.');
    fillet.selector = { kind: 'edgeIndex', index: 0 };

    expectBrepError(() => normalizeBrepProject(project), 'invalid_node');
  });
});
