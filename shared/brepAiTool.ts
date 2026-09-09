import { jsonSchema, zodSchema } from 'ai';
import { z } from 'zod';
import {
  BREP_PROJECT_MAX_ABS_SCALAR,
  BREP_PROJECT_MAX_DESCRIPTION_CHARS,
  BREP_PROJECT_MAX_ID_CHARS,
  BREP_PROJECT_MAX_METADATA_PROPERTIES,
  BREP_PROJECT_MAX_NAME_CHARS,
  BREP_PROJECT_MAX_NODE_INPUTS,
  BREP_PROJECT_MAX_NODES,
  BREP_PROJECT_MAX_OBJECT_POINTS,
  BREP_PROJECT_MAX_PARAMETERS,
  BREP_PROJECT_SCHEMA_VERSION,
  type BrepProject,
} from './brepProject.ts';
import { normalizeBrepAiProjectCandidate } from './brepAiProject.ts';

const brepIdSchema = z
  .string()
  .min(1)
  .max(BREP_PROJECT_MAX_ID_CHARS)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/);

const brepScalarNumberSchema = z
  .number()
  .min(-BREP_PROJECT_MAX_ABS_SCALAR)
  .max(BREP_PROJECT_MAX_ABS_SCALAR);

const brepParameterReferenceSchema = z
  .object({ parameter: brepIdSchema })
  .strict();

const brepScalarSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    brepScalarNumberSchema,
    brepParameterReferenceSchema,
    z
      .object({
        op: z.enum(['add', 'sub', 'mul', 'div']),
        args: z.tuple([brepScalarSchema, brepScalarSchema]),
      })
      .strict(),
    z
      .object({
        op: z.literal('neg'),
        args: z.tuple([brepScalarSchema]),
      })
      .strict(),
  ]),
);

function brepVector3SchemaFor(scalarSchema: z.ZodTypeAny) {
  return z.tuple([scalarSchema, scalarSchema, scalarSchema]);
}

const brepVector3Schema = brepVector3SchemaFor(brepScalarSchema);

const brepPlacementSchema = z
  .object({
    origin: brepVector3Schema,
    xAxis: brepVector3Schema,
    yAxis: brepVector3Schema,
  })
  .strict();

const brepMetadataSchema = z
  .object({
    objectType: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS).optional(),
    classification: z
      .string()
      .min(1)
      .max(BREP_PROJECT_MAX_NAME_CHARS)
      .optional(),
    properties: z
      .record(
        brepIdSchema,
        z.string().min(1).max(BREP_PROJECT_MAX_DESCRIPTION_CHARS),
      )
      .refine(
        (value) => Object.keys(value).length <= BREP_PROJECT_MAX_METADATA_PROPERTIES,
        `BRep metadata may contain at most ${BREP_PROJECT_MAX_METADATA_PROPERTIES} properties.`,
      )
      .optional(),
  })
  .strict();

const brepProjectObjectPointSchema = z
  .object({
    id: brepIdSchema,
    kind: z.enum(['connection', 'mounting', 'cable']),
    position: brepVector3Schema,
    direction: brepVector3Schema.optional(),
    label: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS).optional(),
  })
  .strict();

const brepProjectObjectSchema = z
  .object({
    footprintNodeId: brepIdSchema.optional(),
    clearanceEnvelopeNodeId: brepIdSchema.optional(),
    maintenanceEnvelopeNodeId: brepIdSchema.optional(),
    points: z
      .array(brepProjectObjectPointSchema)
      .max(BREP_PROJECT_MAX_OBJECT_POINTS)
      .optional(),
  })
  .strict();

const brepPublishedNumberParameterSchema = z
  .object({
    id: brepIdSchema,
    label: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS),
    type: z.literal('number'),
    unit: z.enum(['mm', 'deg', 'none']),
    default: brepScalarNumberSchema,
    min: brepScalarNumberSchema.optional(),
    max: brepScalarNumberSchema.optional(),
    step: brepScalarNumberSchema.optional(),
    description: z
      .string()
      .min(1)
      .max(BREP_PROJECT_MAX_DESCRIPTION_CHARS)
      .optional(),
  })
  .strict();

const brepEdgeSelectorSchema = z
  .object({
    kind: z.literal('parallelToAxis'),
    axis: z.enum(['x', 'y', 'z']),
  })
  .strict();

const brepBoxNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('box'),
    width: brepScalarSchema,
    depth: brepScalarSchema,
    height: brepScalarSchema,
  })
  .strict();

const brepCylinderNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('cylinder'),
    radius: brepScalarSchema,
    height: brepScalarSchema,
  })
  .strict();

const brepTransformNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('transform'),
    input: brepIdSchema,
    translate: brepVector3Schema.optional(),
    rotateDeg: brepVector3Schema.optional(),
  })
  .strict();

const brepSubtractNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('subtract'),
    base: brepIdSchema,
    tools: z.array(brepIdSchema).min(1).max(BREP_PROJECT_MAX_NODE_INPUTS),
  })
  .strict();

const brepFilletNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('fillet'),
    input: brepIdSchema,
    radius: brepScalarSchema,
    selector: brepEdgeSelectorSchema,
  })
  .strict();

const brepNodeSchema = z.discriminatedUnion('type', [
  brepBoxNodeSchema,
  brepCylinderNodeSchema,
  brepTransformNodeSchema,
  brepSubtractNodeSchema,
  brepFilletNodeSchema,
]);

/**
 * Provider-visible JSON shape for a complete canonical BRep project. Scalar
 * expressions are recursive but remain bounded by the canonical normalizer;
 * this Zod surface describes only the allowed operation vocabulary and arity.
 */
export const brepAiProjectSchema = z
  .object({
    schemaVersion: z.literal(BREP_PROJECT_SCHEMA_VERSION),
    id: brepIdSchema,
    name: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS),
    units: z.literal('mm'),
    placement: brepPlacementSchema,
    metadata: brepMetadataSchema.optional(),
    projectObject: brepProjectObjectSchema.optional(),
    parameters: z
      .array(brepPublishedNumberParameterSchema)
      .max(BREP_PROJECT_MAX_PARAMETERS),
    nodes: z.array(brepNodeSchema).min(1).max(BREP_PROJECT_MAX_NODES),
    resultNodeId: brepIdSchema,
  })
  .strict()
  .superRefine((project, context) => {
    try {
      normalizeBrepAiProjectCandidate(project);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : 'Invalid canonical BRep project snapshot.',
      });
    }
  });

export const brepAiBuildInputSchema = z
  .object({
    title: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS),
    version: z.string().min(1).max(32).default('v1'),
    project: brepAiProjectSchema,
  })
  .strict();

export type BrepAiBuildInput = Omit<
  z.infer<typeof brepAiBuildInputSchema>,
  'project'
> & { project: BrepProject };

/**
 * Keep the model-facing schema reference-free for OpenAI-compatible/local
 * providers whose JSON-schema-to-grammar paths do not reliably support nested
 * `$ref`. Three expression levels cover the ordinary derived relationships M1
 * is intended to author (`width - 2 * wallThickness`, half offsets, scaled
 * spacing, etc.). The canonical validator below remains authoritative and
 * still accepts the full M1 depth/node limits for persisted/imported projects.
 */
export const BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH = 3;

function createBrepProviderScalarSchema(depth: number): z.ZodTypeAny {
  const leafSchema = z.union([
    brepScalarNumberSchema,
    brepParameterReferenceSchema,
  ]);
  if (depth <= 0) return leafSchema;

  const childSchema = createBrepProviderScalarSchema(depth - 1);
  return z.union([
    brepScalarNumberSchema,
    brepParameterReferenceSchema,
    z
      .object({
        op: z.enum(['add', 'sub', 'mul', 'div']),
        args: z.tuple([childSchema, childSchema]),
      })
      .strict(),
    z
      .object({
        op: z.literal('neg'),
        args: z.tuple([childSchema]),
      })
      .strict(),
  ]);
}

const brepProviderScalarSchema = createBrepProviderScalarSchema(
  BREP_AI_PROVIDER_EXPRESSION_MAX_DEPTH,
);
const brepProviderVector3Schema = brepVector3SchemaFor(
  brepProviderScalarSchema,
);
const brepProviderPlacementSchema = z
  .object({
    origin: brepProviderVector3Schema,
    xAxis: brepProviderVector3Schema,
    yAxis: brepProviderVector3Schema,
  })
  .strict();
const brepProviderProjectObjectPointSchema = z
  .object({
    id: brepIdSchema,
    kind: z.enum(['connection', 'mounting', 'cable']),
    position: brepProviderVector3Schema,
    direction: brepProviderVector3Schema.optional(),
    label: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS).optional(),
  })
  .strict();
const brepProviderProjectObjectSchema = z
  .object({
    footprintNodeId: brepIdSchema.optional(),
    clearanceEnvelopeNodeId: brepIdSchema.optional(),
    maintenanceEnvelopeNodeId: brepIdSchema.optional(),
    points: z
      .array(brepProviderProjectObjectPointSchema)
      .max(BREP_PROJECT_MAX_OBJECT_POINTS)
      .optional(),
  })
  .strict();
const brepProviderBoxNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('box'),
    width: brepProviderScalarSchema,
    depth: brepProviderScalarSchema,
    height: brepProviderScalarSchema,
  })
  .strict();
const brepProviderCylinderNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('cylinder'),
    radius: brepProviderScalarSchema,
    height: brepProviderScalarSchema,
  })
  .strict();
const brepProviderTransformNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('transform'),
    input: brepIdSchema,
    translate: brepProviderVector3Schema.optional(),
    rotateDeg: brepProviderVector3Schema.optional(),
  })
  .strict();
const brepProviderFilletNodeSchema = z
  .object({
    id: brepIdSchema,
    type: z.literal('fillet'),
    input: brepIdSchema,
    radius: brepProviderScalarSchema,
    selector: brepEdgeSelectorSchema,
  })
  .strict();
const brepProviderNodeSchema = z.discriminatedUnion('type', [
  brepProviderBoxNodeSchema,
  brepProviderCylinderNodeSchema,
  brepProviderTransformNodeSchema,
  brepSubtractNodeSchema,
  brepProviderFilletNodeSchema,
]);
const brepAiProviderProjectSchema = z
  .object({
    schemaVersion: z.literal(BREP_PROJECT_SCHEMA_VERSION),
    id: brepIdSchema,
    name: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS),
    units: z.literal('mm'),
    placement: brepProviderPlacementSchema,
    metadata: brepMetadataSchema.optional(),
    projectObject: brepProviderProjectObjectSchema.optional(),
    parameters: z
      .array(brepPublishedNumberParameterSchema)
      .max(BREP_PROJECT_MAX_PARAMETERS),
    nodes: z.array(brepProviderNodeSchema).min(1).max(BREP_PROJECT_MAX_NODES),
    resultNodeId: brepIdSchema,
  })
  .strict();
const brepAiProviderBuildInputZodSchema = z
  .object({
    title: z.string().min(1).max(BREP_PROJECT_MAX_NAME_CHARS),
    version: z.string().min(1).max(32).default('v1'),
    project: brepAiProviderProjectSchema,
  })
  .strict();
const brepAiProviderJsonSchema = zodSchema(
  brepAiProviderBuildInputZodSchema,
);

/**
 * The provider sees the bounded, reference-free schema above, while every tool
 * call is validated against the full recursive/canonical schema before use.
 */
export const brepAiBuildProviderInputSchema = jsonSchema<BrepAiBuildInput>(
  () => brepAiProviderJsonSchema.jsonSchema,
  {
    validate: async (value) => {
      const result = await brepAiBuildInputSchema.safeParseAsync(value);
      return result.success
        ? { success: true, value: result.data as BrepAiBuildInput }
        : { success: false, error: result.error };
    },
  },
);

export const brepAiBuildOutputSchema = z
  .object({
    status: z.literal('success'),
    message: z.string().min(1),
  })
  .strict();

export type BrepAiBuildOutput = z.infer<typeof brepAiBuildOutputSchema>;