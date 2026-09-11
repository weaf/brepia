import { describe, expect, it, vi } from 'vitest';
import {
  BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH,
  brepAiBuildProviderInputSchema,
  brepAiProviderBuildInputZodSchema,
} from '../shared/brepAiTool';
import { chatTools } from '../shared/chatAi';

const PROVIDER_SCHEMA_SIZE_REGRESSION_LIMIT_BYTES = 180_000;

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

function ordinaryM1RelationshipInput() {
  return {
    title: 'Derived width fixture',
    version: 'v1',
    project: {
      schemaVersion: 1,
      id: 'derivedWidthFixture',
      name: 'Derived width fixture',
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
        {
          id: 'wallThickness',
          label: 'Wall thickness',
          type: 'number',
          unit: 'mm',
          default: 50,
        },
      ],
      nodes: [
        {
          id: 'body',
          type: 'box',
          width: {
            op: 'sub',
            args: [
              { parameter: 'width' },
              {
                op: 'mul',
                args: [2, { parameter: 'wallThickness' }],
              },
            ],
          },
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

  it('keeps ordinary M1 derived authoring within the depth-2 provider boundary', () => {
    expect(BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH).toBe(2);
    expect(
      brepAiProviderBuildInputZodSchema.safeParse(
        ordinaryM1RelationshipInput(),
      ).success,
    ).toBe(true);
  });

  it('keeps bounded provider expression arity exact after compact schema projection', () => {
    const base = ordinaryM1RelationshipInput();
    const unaryBinary = structuredClone(base);
    (unaryBinary.project.nodes[0] as { width: unknown }).width = {
      op: 'add',
      args: [1],
    };
    expect(brepAiProviderBuildInputZodSchema.safeParse(unaryBinary).success).toBe(false);

    const binaryNegation = structuredClone(base);
    (binaryNegation.project.nodes[0] as { width: unknown }).width = {
      op: 'neg',
      args: [1, 2],
    };
    expect(brepAiProviderBuildInputZodSchema.safeParse(binaryNegation).success).toBe(false);
  });

  it('keeps the provider schema below the C1 size regression ceiling', async () => {
    const jsonSchema = await Promise.resolve(
      brepAiBuildProviderInputSchema.jsonSchema,
    );
    const serialized = JSON.stringify(jsonSchema);
    const serializedBytes = new TextEncoder().encode(serialized).byteLength;

    expect(serializedBytes).toBeLessThan(
      PROVIDER_SCHEMA_SIZE_REGRESSION_LIMIT_BYTES,
    );
  });

  it('keeps full recursive canonical validation behind the bounded provider schema', async () => {
    const input = deeplyNestedInput();
    expect(brepAiProviderBuildInputZodSchema.safeParse(input).success).toBe(
      false,
    );

    const validate = brepAiBuildProviderInputSchema.validate;
    expect(validate).toBeDefined();

    const result = await validate!(input);
    expect(result.success).toBe(true);
  });

  it('uses the reference-free provider schema on the actual build_brep_project tool', () => {
    expect(chatTools.build_brep_project.inputSchema).toBe(
      brepAiBuildProviderInputSchema,
    );
  });
});
