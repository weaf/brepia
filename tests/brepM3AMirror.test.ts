import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'vitest';

import {
  BrepProjectError,
  normalizeBrepProject,
  type BrepProject,
} from '../shared/brepProject.ts';
import {
  brepAiBuildInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';
import { createBrepGrasshopperRhinoScriptPlan } from '../shared/brepGrasshopperRhinoScript.ts';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity.ts';
import { normalizeBrepEvaluationRequest } from '../shared/brepProvider.ts';

const grasshopperFixture = JSON.parse(
  fs.readFileSync(
    new URL(
      '../grasshopper/fixtures/cabinet-a42.brepia-grasshopper.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as Record<string, unknown>;

function mirrorProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3amirror',
    name: 'M3A mirror',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'planeOffset',
        label: 'Plane offset',
        type: 'number',
        unit: 'mm',
        default: 5,
        min: -100,
        max: 100,
        step: 1,
      },
    ],
    nodes: [
      { id: 'body', type: 'box', width: 20, depth: 10, height: 10 },
      { id: 'moved', type: 'transform', input: 'body', translate: [30, 0, 0] },
      {
        id: 'mirrored',
        type: 'mirror',
        input: 'moved',
        normalAxis: 'x',
        offset: { parameter: 'planeOffset' },
      },
    ],
    resultNodeId: 'mirrored',
  };
}

function expectProjectError(
  operation: () => unknown,
  code: BrepProjectError['code'],
): void {
  assert.throws(
    operation,
    (error: unknown) => error instanceof BrepProjectError && error.code === code,
  );
}

function grasshopperMirrorFixture() {
  const fixture = JSON.parse(JSON.stringify(grasshopperFixture)) as {
    source: {
      nodes: Array<Record<string, unknown>>;
      resultNodeId: string;
      projectObject?: { footprintNodeId?: string };
    };
  } & Record<string, unknown>;
  const body = fixture.source.nodes[0];
  assert.ok(body);
  fixture.source.nodes = [
    body,
    {
      id: 'movedBody',
      type: 'transform',
      input: String(body.id),
      translate: [100, 0, 0],
    },
    {
      id: 'mirroredBody',
      type: 'mirror',
      input: 'movedBody',
      normalAxis: 'x',
      offset: { parameter: 'width' },
    },
  ];
  fixture.source.resultNodeId = 'mirroredBody';
  if (fixture.source.projectObject) {
    fixture.source.projectObject.footprintNodeId = 'mirroredBody';
  }
  return fixture;
}

describe('M3A mirror', () => {
  it('normalizes a parameter-backed mirror without changing schemaVersion 1', () => {
    const project = normalizeBrepProject(mirrorProject());
    const node = project.nodes.find((candidate) => candidate.id === 'mirrored');
    assert.ok(node && node.type === 'mirror');
    assert.equal(node.input, 'moved');
    assert.equal(node.normalAxis, 'x');
    assert.deepEqual(node.offset, { parameter: 'planeOffset' });
    assert.equal(project.schemaVersion, 1);
  });

  it.each(['x', 'y', 'z'] as const)('accepts %s as a mirror normal axis', (normalAxis) => {
    const project = mirrorProject();
    const node = project.nodes.find((candidate) => candidate.id === 'mirrored');
    assert.ok(node && node.type === 'mirror');
    node.normalAxis = normalAxis;
    const normalized = normalizeBrepProject(project);
    const normalizedNode = normalized.nodes.find(
      (candidate) => candidate.id === 'mirrored',
    );
    assert.ok(normalizedNode && normalizedNode.type === 'mirror');
    assert.equal(normalizedNode.normalAxis, normalAxis);
  });

  it('rejects unsupported mirror axes', () => {
    const project = mirrorProject() as unknown as {
      nodes: Array<Record<string, unknown>>;
    };
    const node = project.nodes.find((candidate) => candidate.id === 'mirrored');
    assert.ok(node);
    node.normalAxis = 'diagonal';
    expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
  });

  it('keeps mirror inside canonical reference and cycle validation', () => {
    const missing = mirrorProject();
    const missingNode = missing.nodes.find((candidate) => candidate.id === 'mirrored');
    assert.ok(missingNode && missingNode.type === 'mirror');
    missingNode.input = 'missing';
    expectProjectError(() => normalizeBrepProject(missing), 'invalid_reference');

    const cyclic = mirrorProject();
    const cyclicNode = cyclic.nodes.find((candidate) => candidate.id === 'mirrored');
    assert.ok(cyclicNode && cyclicNode.type === 'mirror');
    cyclicNode.input = 'mirrored';
    expectProjectError(() => normalizeBrepProject(cyclic), 'cycle');
  });

  it('requires a millimetre-compatible mirror offset', () => {
    const project = mirrorProject();
    project.parameters.push({
      id: 'angle',
      label: 'Angle',
      type: 'number',
      unit: 'deg',
      default: 0,
    });
    const node = project.nodes.find((candidate) => candidate.id === 'mirrored');
    assert.ok(node && node.type === 'mirror');
    node.offset = { parameter: 'angle' };
    expectProjectError(() => normalizeBrepProject(project), 'invalid_parameter');
  });

  it('resolves mirror offset through the ordinary runtime parameter override path', () => {
    const request = normalizeBrepEvaluationRequest({
      project: mirrorProject(),
      parameterValues: { planeOffset: 12 },
    });
    assert.equal(request.parameterValues.planeOffset, 12);
  });

  it('treats mirror input and offset parameter as authoritative dependencies', () => {
    const integrity = analyzeBrepProjectIntegrity(mirrorProject());
    assert.deepEqual(integrity.resultReachableNodeIds, ['body', 'mirrored', 'moved']);
    assert.deepEqual(integrity.effectiveParameterIds, ['planeOffset']);
    assert.deepEqual(integrity.orphanNodeIds, []);
  });

  it('accepts mirror through both canonical and finite provider authoring schemas', async () => {
    const input = {
      title: 'M3A mirror',
      version: 'v1',
      project: mirrorProject(),
    };
    const canonical = await brepAiBuildInputSchema.safeParseAsync(input);
    const provider = await brepAiProviderBuildInputZodSchema.safeParseAsync(input);
    assert.equal(canonical.success, true);
    assert.equal(provider.success, true);
  });

  it('maps the x-normal mirror to a Rhino YZ-equivalent plane and Mirror transform', async () => {
    const script = await createBrepGrasshopperRhinoScriptPlan(
      grasshopperMirrorFixture(),
    );
    assert.match(script.source, /DuplicateBrep\(\)/);
    assert.match(
      script.source,
      /MirrorPlane = rg\.Plane\(rg\.Point3d\(float\(brepia_scalar\(Width\)\), 0, 0\), rg\.Vector3d\(1, 0, 0\)\)/,
    );
    assert.match(script.source, /rg\.Transform\.Mirror\(brepiaNode\d+MirrorPlane\)/);
    assert.match(script.source, /Rhino could not mirror Brepia node mirroredBody/);
    assert.doesNotMatch(script.source, /boolean union for Brepia node mirroredBody/);
  });

  it('maps canonical axes and positive offsets to oriented build123d mirror planes', () => {
    const driver = fs.readFileSync(
      new URL('../scripts/brep/brep_driver.py', import.meta.url),
      'utf8',
    );
    assert.match(driver, /"x": Plane\.YZ/);
    assert.match(driver, /"y": Plane\.ZX/);
    assert.match(driver, /"z": Plane\.XY/);
    assert.match(driver, /\.offset\(scalar\(node\["offset"\], parameters\)\)/);
    assert.match(driver, /input_shape\.mirror\(mirror_plane\)/);
  });

  it('exposes mirror input, normal axis, and scalar offset in the structural editor', () => {
    const source = fs.readFileSync(
      new URL('../src/components/brep/BrepFeatureEditor.tsx', import.meta.url),
      'utf8',
    );
    assert.match(source, /'mirror'/);
    assert.match(source, /Mirror plane normal axis/);
    assert.match(source, /Plane offset/);
    assert.match(source, /X · YZ plane/);
    assert.match(source, /Mirror returns only the reflected input/);
  });
});
