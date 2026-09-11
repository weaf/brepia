import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  BREP_PROJECT_MAX_PATTERN_COUNT,
  BREP_PROJECT_MAX_RECTANGULAR_PATTERN_INSTANCES,
  BrepProjectError,
  brepNodeValueKind,
  normalizeBrepProject,
  type BrepProject,
} from '../shared/brepProject.ts';
import {
  brepAiBuildInputSchema,
  brepAiBuildProviderInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity.ts';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
} from '../shared/brepProvider.ts';

function rectangularProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3crectangular',
    name: 'M3C rectangular pattern',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'spacingA',
        label: 'Spacing A',
        type: 'number',
        unit: 'mm',
        default: 30,
        min: -100,
        max: 100,
      },
      {
        id: 'spacingBaseB',
        label: 'Spacing base B',
        type: 'number',
        unit: 'mm',
        default: 20,
        min: -100,
        max: 100,
      },
    ],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 10, height: 10 },
      {
        id: 'pattern',
        type: 'rectangularPattern',
        input: 'body',
        axisA: 'x',
        axisB: 'y',
        countA: 3,
        countB: 4,
        spacingA: { parameter: 'spacingA' },
        spacingB: {
          op: 'add',
          args: [{ parameter: 'spacingBaseB' }, 5],
        },
      },
    ],
    resultNodeId: 'pattern',
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

function pattern(project: BrepProject) {
  const node = project.nodes.find((candidate) => candidate.id === 'pattern');
  assert.ok(node && node.type === 'rectangularPattern');
  return node;
}

describe('M3C rectangular pattern canonical contract', () => {
  it('normalizes the bounded instance-set without changing schemaVersion 1', () => {
    const project = normalizeBrepProject(rectangularProject());
    const node = pattern(project);
    assert.equal(node.axisA, 'x');
    assert.equal(node.axisB, 'y');
    assert.equal(node.countA, 3);
    assert.equal(node.countB, 4);
    assert.deepEqual(node.spacingA, { parameter: 'spacingA' });
    assert.deepEqual(node.spacingB, {
      op: 'add',
      args: [{ parameter: 'spacingBaseB' }, 5],
    });
    assert.equal(brepNodeValueKind(node), 'instanceSet');
    assert.equal(project.schemaVersion, 1);
  });

  it('requires distinct canonical axes', () => {
    const project = rectangularProject();
    pattern(project).axisB = 'x';
    expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
  });

  it('requires literal integer counts in 2..32 and caps countA * countB at 64', () => {
    for (const [field, value] of [
      ['countA', 1],
      ['countA', BREP_PROJECT_MAX_PATTERN_COUNT + 1],
      ['countA', 2.5],
      ['countB', 1],
      ['countB', BREP_PROJECT_MAX_PATTERN_COUNT + 1],
      ['countB', 2.5],
    ] as const) {
      const project = rectangularProject();
      pattern(project)[field] = value;
      expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
    }

    const atLimit = rectangularProject();
    pattern(atLimit).countA = 8;
    pattern(atLimit).countB = 8;
    assert.equal(
      pattern(normalizeBrepProject(atLimit)).countA *
        pattern(normalizeBrepProject(atLimit)).countB,
      BREP_PROJECT_MAX_RECTANGULAR_PATTERN_INSTANCES,
    );

    const overLimit = rectangularProject();
    pattern(overLimit).countA = 8;
    pattern(overLimit).countB = 9;
    expectProjectError(() => normalizeBrepProject(overLimit), 'invalid_node');
  });

  it('tracks both spacing expressions through M0 effectiveness and M1 scalar traversal', () => {
    const integrity = analyzeBrepProjectIntegrity(rectangularProject());
    assert.deepEqual(integrity.resultReachableNodeIds, ['body', 'pattern']);
    assert.deepEqual(integrity.effectiveParameterIds, ['spacingA', 'spacingBaseB']);
    assert.deepEqual(integrity.orphanNodeIds, []);
  });

  it('rejects default and runtime spacing values that resolve to zero', () => {
    const zeroA = rectangularProject();
    zeroA.parameters.find((parameter) => parameter.id === 'spacingA')!.default = 0;
    expectProjectError(() => normalizeBrepProject(zeroA), 'invalid_parameter');

    const zeroB = rectangularProject();
    zeroB.parameters.find((parameter) => parameter.id === 'spacingBaseB')!.default = -5;
    expectProjectError(() => normalizeBrepProject(zeroB), 'invalid_parameter');

    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project: rectangularProject(),
          parameterValues: { spacingA: 0 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /spacingA.*non-zero/.test(error.message),
    );
    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project: rectangularProject(),
          parameterValues: { spacingBaseB: -5 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /spacingB.*non-zero/.test(error.message),
    );
  });

  it('requires a single input and rejects linear or rectangular instance-set nesting', () => {
    for (const nestedType of ['linearPattern', 'rectangularPattern'] as const) {
      const project = rectangularProject();
      if (nestedType === 'linearPattern') {
        project.nodes.push({
          id: 'nested',
          type: 'linearPattern',
          input: 'pattern',
          axis: 'z',
          count: 2,
          spacing: 10,
        });
      } else {
        project.nodes.push({
          id: 'nested',
          type: 'rectangularPattern',
          input: 'pattern',
          axisA: 'y',
          axisB: 'z',
          countA: 2,
          countB: 2,
          spacingA: 10,
          spacingB: 10,
        });
      }
      project.resultNodeId = 'nested';
      expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
    }
  });

  it('permits rectangular instance sets only in subtract.tools[] and preserves tool order', () => {
    const project = rectangularProject();
    project.nodes.push(
      { id: 'base', type: 'box', width: 200, depth: 200, height: 20 },
      { id: 'singleTool', type: 'cylinder', radius: 2, height: 40 },
      {
        id: 'cut',
        type: 'subtract',
        base: 'base',
        tools: ['singleTool', 'pattern'],
      },
    );
    project.resultNodeId = 'cut';
    const normalized = normalizeBrepProject(project);
    const cut = normalized.nodes.find((node) => node.id === 'cut');
    assert.ok(cut && cut.type === 'subtract');
    assert.deepEqual(cut.tools, ['singleTool', 'pattern']);

    const invalidBase = rectangularProject();
    invalidBase.nodes.push(
      { id: 'tool', type: 'box', width: 2, depth: 2, height: 2 },
      { id: 'cut', type: 'subtract', base: 'pattern', tools: ['tool'] },
    );
    invalidBase.resultNodeId = 'cut';
    expectProjectError(() => normalizeBrepProject(invalidBase), 'invalid_node');
  });

  it('accepts depth-2 expressions through the finite provider schema and remains reference-free', async () => {
    const project = rectangularProject();
    pattern(project).spacingB = {
      op: 'sub',
      args: [
        { parameter: 'spacingBaseB' },
        { op: 'neg', args: [5] },
      ],
    };
    const input = { title: 'M3C rectangular pattern', version: 'v1', project };
    assert.equal((await brepAiBuildInputSchema.safeParseAsync(input)).success, true);
    assert.equal(
      (await brepAiProviderBuildInputZodSchema.safeParseAsync(input)).success,
      true,
    );
    const jsonSchema = await Promise.resolve(brepAiBuildProviderInputSchema.jsonSchema);
    const serialized = JSON.stringify(jsonSchema);
    assert.match(serialized, /rectangularPattern/);
    assert.doesNotMatch(serialized, /"\$ref"/);
  });
});
