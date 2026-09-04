import { describe, expect, it } from 'vitest';
import {
  BrepAiProjectError,
  diffBrepProjects,
  normalizeBrepAiProjectCandidate,
  validateBrepAiFollowUp,
} from '../shared/brepAiProject';
import {
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from '../shared/brepProject';

function project(): BrepProject {
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
    metadata: { objectType: 'cabinet' },
    parameters: [
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
        id: 'width',
        label: 'Width',
        type: 'number',
        unit: 'mm',
        default: 1200,
        min: 600,
        max: 2400,
        step: 50,
      },
    ],
    nodes: [
      {
        id: 'body',
        type: 'box',
        width: { parameter: 'width' },
        depth: 600,
        height: { parameter: 'height' },
      },
      {
        id: 'finished',
        type: 'fillet',
        input: 'body',
        radius: 20,
        selector: { kind: 'parallelToAxis', axis: 'z' },
      },
    ],
    resultNodeId: 'finished',
  };
}

function expectAiError(
  action: () => unknown,
  code: BrepAiProjectError['code'],
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(BrepAiProjectError);
    expect((error as BrepAiProjectError).code).toBe(code);
    return;
  }
  throw new Error(`Expected BrepAiProjectError with code ${code}.`);
}

describe('BRep AI project contract', () => {
  it('normalizes complete AI candidates through the canonical BRep schema', () => {
    const candidate = project();
    candidate.parameters.reverse();
    candidate.nodes.reverse();

    const normalized = normalizeBrepAiProjectCandidate(candidate);

    expect(normalized.id).toBe('cabinetA42');
    expect(normalized.parameters.map((parameter) => parameter.id)).toEqual([
      'height',
      'width',
    ]);
    expect(normalized.nodes.map((node) => node.id)).toEqual([
      'body',
      'finished',
    ]);
  });

  it('produces no false diff when only source array ordering changes', () => {
    const previous = project();
    const next = project();
    next.parameters.reverse();
    next.nodes.reverse();

    const diff = diffBrepProjects(previous, next);

    expect(diff.projectPaths).toEqual([]);
    expect(diff.parameters.added).toEqual([]);
    expect(diff.parameters.removed).toEqual([]);
    expect(diff.parameters.changed).toEqual([]);
    expect(diff.parameters.unchanged).toBe(2);
    expect(diff.nodes.changed).toEqual([]);
    expect(diff.nodes.unchanged).toBe(2);
    expect(diff.summary).toBe('No structural BRep changes.');
  });

  it('reports parameter-only edits by stable parameter id and field path', () => {
    const previous = project();
    const next = project();
    const width = next.parameters.find((parameter) => parameter.id === 'width');
    if (!width) throw new Error('Fixture is invalid.');
    width.default = 1400;
    width.max = 2800;

    const { project: validated, diff } = validateBrepAiFollowUp(previous, next);

    expect(validated.id).toBe(previous.id);
    expect(diff.parameters.changed).toEqual([
      {
        id: 'width',
        paths: ['parameters.width.default', 'parameters.width.max'],
      },
    ]);
    expect(diff.parameters.unchanged).toBe(1);
    expect(diff.nodes.unchanged).toBe(2);
    expect(diff.summary).toContain('1 parameter changed');
  });

  it('reports node modifications and additions without losing existing ids', () => {
    const previous = project();
    const next = project();
    const body = next.nodes.find((node) => node.id === 'body');
    if (!body || body.type !== 'box') throw new Error('Fixture is invalid.');
    body.depth = 750;
    next.nodes.push({
      id: 'translated',
      type: 'transform',
      input: 'finished',
      translate: [100, 0, 0],
    });
    next.resultNodeId = 'translated';

    const diff = validateBrepAiFollowUp(previous, next).diff;

    expect(diff.nodes.added).toEqual(['translated']);
    expect(diff.nodes.changed).toEqual([
      { id: 'body', paths: ['nodes.body.depth'] },
    ]);
    expect(diff.nodes.unchanged).toBe(1);
    expect(diff.projectPaths).toEqual(['project.resultNodeId']);
  });

  it('reports valid node and parameter removal by stable id', () => {
    const previous = project();
    const next = project();
    next.nodes = next.nodes.filter((node) => node.id !== 'finished');
    next.resultNodeId = 'body';

    const diff = validateBrepAiFollowUp(previous, next).diff;

    expect(diff.nodes.removed).toEqual(['finished']);
    expect(diff.nodes.unchanged).toBe(1);
  });

  it('rejects a follow-up that changes the project id', () => {
    const next = project();
    next.id = 'replacementProject';

    expectAiError(
      () => validateBrepAiFollowUp(project(), next),
      'project_id_changed',
    );
  });

  it('rejects obvious whole-graph node-id churn on an ordinary follow-up', () => {
    const next = project();
    next.nodes = [
      {
        id: 'replacementBody',
        type: 'box',
        width: { parameter: 'width' },
        depth: 600,
        height: { parameter: 'height' },
      },
      {
        id: 'replacementFinished',
        type: 'fillet',
        input: 'replacementBody',
        radius: 20,
        selector: { kind: 'parallelToAxis', axis: 'z' },
      },
    ];
    next.resultNodeId = 'replacementFinished';

    expectAiError(
      () => validateBrepAiFollowUp(project(), next),
      'unstable_node_identity',
    );
  });

  it('fails closed when AI invents unsupported raw topology selectors', () => {
    const candidate = project() as unknown as {
      nodes: Array<Record<string, unknown>>;
    } & Omit<BrepProject, 'nodes'>;
    const fillet = candidate.nodes.find((node) => node.id === 'finished');
    if (!fillet) throw new Error('Fixture is invalid.');
    fillet.selector = { kind: 'edgeIndex', index: 0 };

    expectAiError(
      () => normalizeBrepAiProjectCandidate(candidate),
      'invalid_candidate',
    );
  });
});
