import { describe, expect, it, vi } from 'vitest';
import {
  BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH,
  brepAiBuildProviderInputSchema,
} from '../shared/brepAiTool';
import { chatTools } from '../shared/chatAi';

function deeplyNestedInput() {
  let width: unknown = { parameter: 'width' };
  for (
    let depth = 0;
    depth <= BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH;
    depth += 1
  ) {
    width = { op: 'neg', args: [width] };
  }

  return {
    title: 'Deep expression fixture',
    version: 'v1',
    project: {
      schemaVersion: 1,
      id: 'deepExpressionFixture',
      name: 'Deep expression fixture',
      units: 'mm',
      placement: {
        origin: [0, 0, 0],
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
      },
      parameters: [
        {
          id: 'width',
          label: 'Width',
          type: 'number',
          unit: 'mm',
          default: 1200,
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'box',
          width,
          depth: 600,
          height: 1800,
        },
      ],
      resultNodeId: 'body',
    },
  };
}

describe('BRep AI provider JSON Schema', () => {
  it('materializes M1 scalar operands without recursive-reference warnings or refs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const jsonSchema = await Promise.resolve(
        brepAiBuildProviderInputSchema.jsonSchema,
      );
      const serialized = JSON.stringify(jsonSchema);

      expect(serialized).not.toContain('"$ref"');
      expect(serialized).toContain('"add"');
      expect(serialized).toContain('"sub"');
      expect(serialized).toContain('"mul"');
      expect(serialized).toContain('"div"');
      expect(serialized).toContain('"neg"');
      expect(
        warn.mock.calls.some(([message]) =>
          String(message).includes('Recursive reference detected'),
        ),
      ).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps full recursive canonical validation behind the bounded provider schema', async () => {
    const validate = brepAiBuildProviderInputSchema.validate;
    expect(validate).toBeDefined();

    const result = await validate!(deeplyNestedInput());
    expect(result.success).toBe(true);
  });

  it('uses the reference-free provider schema on the actual build_brep_project tool', () => {
    expect(chatTools.build_brep_project.inputSchema).toBe(
      brepAiBuildProviderInputSchema,
    );
  });
});
