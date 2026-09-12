import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  BREP_PROJECT_MAX_PATTERN_COUNT,
  BrepProjectError,
  brepNodeValueKind,
  normalizeBrepProject,
  type BrepProject,
} from '../shared/brepProject.ts';
import {
  brepAiBuildInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool.ts';
import { analyzeBrepProjectIntegrity } from '../shared/brepProjectIntegrity.ts';
import {
  BrepEvaluationRequestError,
  normalizeBrepEvaluationRequest,
} from '../shared/brepProvider.ts';

function patternProject(): BrepProject {
  return {
    schemaVersion: 1,
    id: 'm3bpattern',
    name: 'M3B linear pattern',
    units: 'mm',
    placement: {
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
    },
    parameters: [
      {
        id: 'spacing',
        label: 'Spacing',
        type: 'number',
        unit: 'mm',
        default: 30,
        min: -100,
        max: 100,
        step: 1,
      },
    ],
    nodes: [
      { id: 'body', type: 'box', width: 10, depth: 10, height: 10 },
      {
        id: 'pattern',
        type: 'linearPattern',
        input: 'body',
        axis: 'x',
        count: 4,
        spacing: { parameter: 'spacing' },
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

describe('M3B linear pattern canonical contract', () => {
  it('normalizes a bounded instance-set result without changing schemaVersion 1', () => {
    const project = normalizeBrepProject(patternProject());
    const pattern = project.nodes.find((node) => node.id === 'pattern');
    assert.ok(pattern && pattern.type === 'linearPattern');
    assert.equal(pattern.axis, 'x');
    assert.equal(pattern.count, 4);
    assert.deepEqual(pattern.spacing, { parameter: 'spacing' });
    assert.equal(brepNodeValueKind(pattern), 'instanceSet');
    assert.equal(
      brepNodeValueKind(project.nodes.find((node) => node.id === 'body')!),
      'single',
    );
    assert.equal(project.resultNodeId, 'pattern');
    assert.equal(project.schemaVersion, 1);
  });

  it.each(['x', 'y', 'z'] as const)('accepts %s pattern axis', (axis) => {
    const project = patternProject();
    const pattern = project.nodes.find((node) => node.id === 'pattern');
    assert.ok(pattern && pattern.type === 'linearPattern');
    pattern.axis = axis;
    const normalized = normalizeBrepProject(project);
    const normalizedPattern = normalized.nodes.find((node) => node.id === 'pattern');
    assert.ok(normalizedPattern && normalizedPattern.type === 'linearPattern');
    assert.equal(normalizedPattern.axis, axis);
  });

  it('requires literal integer count between 2 and the bounded maximum', () => {
    for (const count of [1, BREP_PROJECT_MAX_PATTERN_COUNT + 1, 2.5]) {
      const project = patternProject();
      const pattern = project.nodes.find((node) => node.id === 'pattern');
      assert.ok(pattern && pattern.type === 'linearPattern');
      pattern.count = count;
      expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
    }
  });

  it('rejects a zero spacing default but accepts negative spacing', () => {
    const zero = patternProject();
    zero.parameters[0]!.default = 0;
    expectProjectError(() => normalizeBrepProject(zero), 'invalid_parameter');

    const negative = patternProject();
    negative.parameters[0]!.default = -30;
    const normalized = normalizeBrepProject(negative);
    const pattern = normalized.nodes.find((node) => node.id === 'pattern');
    assert.ok(pattern && pattern.type === 'linearPattern');
  });

  it('rejects a runtime parameter override that resolves spacing to zero', () => {
    assert.throws(
      () =>
        normalizeBrepEvaluationRequest({
          project: patternProject(),
          parameterValues: { spacing: 0 },
        }),
      (error: unknown) =>
        error instanceof BrepEvaluationRequestError &&
        error.code === 'invalid_parameter_value' &&
        /non-zero/.test(error.message),
    );
  });

  it('tracks the pattern input and spacing parameter through M0/M1 integrity', () => {
    const integrity = analyzeBrepProjectIntegrity(patternProject());
    assert.deepEqual(integrity.resultReachableNodeIds, ['body', 'pattern']);
    assert.deepEqual(integrity.effectiveParameterIds, ['spacing']);
    assert.deepEqual(integrity.orphanNodeIds, []);
  });

  it('accepts linearPattern through canonical and finite provider authoring schemas', async () => {
    const input = {
      title: 'M3B linear pattern',
      version: 'v1',
      project: patternProject(),
    };
    const canonical = await brepAiBuildInputSchema.safeParseAsync(input);
    const provider = await brepAiProviderBuildInputZodSchema.safeParseAsync(input);
    assert.equal(canonical.success, true);
    assert.equal(provider.success, true);
  });

  it('rejects nested patterns because linearPattern input must be single-valued', () => {
    const project = patternProject();
    project.nodes.push({
      id: 'nested',
      type: 'linearPattern',
      input: 'pattern',
      axis: 'y',
      count: 2,
      spacing: 20,
    });
    project.resultNodeId = 'nested';
    expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
  });

  it.each(['transform', 'mirror', 'fillet'] as const)(
    'rejects instance-set input to %s',
    (type) => {
      const project = patternProject();
      if (type === 'transform') {
        project.nodes.push({
          id: 'consumer',
          type,
          input: 'pattern',
          translate: [1, 0, 0],
        });
      } else if (type === 'mirror') {
        project.nodes.push({
          id: 'consumer',
          type,
          input: 'pattern',
          normalAxis: 'x',
          offset: 0,
        });
      } else {
        project.nodes.push({
          id: 'consumer',
          type,
          input: 'pattern',
          radius: 1,
          selector: { kind: 'parallelToAxis', axis: 'z' },
        });
      }
      project.resultNodeId = 'consumer';
      expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
    },
  );

  it.each(['union', 'intersect'] as const)(
    'rejects instance-set inputs to %s',
    (type) => {
      const project = patternProject();
      project.nodes.push({
        id: 'other',
        type: 'box',
        width: 5,
        depth: 5,
        height: 5,
      });
      project.nodes.push({
        id: 'consumer',
        type,
        inputs: ['pattern', 'other'],
      });
      project.resultNodeId = 'consumer';
      expectProjectError(() => normalizeBrepProject(project), 'invalid_node');
    },
  );

  it('rejects instance-set subtract base but permits instance-set subtract tools', () => {
    const invalidBase = patternProject();
    invalidBase.nodes.push({
      id: 'tool',
      type: 'box',
      width: 2,
      depth: 2,
      height: 20,
    });
    invalidBase.nodes.push({
      id: 'cut',
      type: 'subtract',
      base: 'pattern',
      tools: ['tool'],
    });
    invalidBase.resultNodeId = 'cut';
    expectProjectError(() => normalizeBrepProject(invalidBase), 'invalid_node');

    const validTool = patternProject();
    validTool.nodes.push({
      id: 'plate',
      type: 'box',
      width: 120,
      depth: 20,
      height: 10,
    });
    validTool.nodes.push({
      id: 'cut',
      type: 'subtract',
      base: 'plate',
      tools: ['pattern'],
    });
    validTool.resultNodeId = 'cut';
    const normalized = normalizeBrepProject(validTool);
    const cut = normalized.nodes.find((node) => node.id === 'cut');
    assert.ok(cut && cut.type === 'subtract');
    assert.deepEqual(cut.tools, ['pattern']);
  });

  it('rejects an instance set assigned to a project-object geometry role', () => {
    const project = patternProject();
    project.projectObject = { footprintNodeId: 'pattern' };
    expectProjectError(
      () => normalizeBrepProject(project),
      'invalid_project_object',
    );
  });
});
