import { zodSchema } from 'ai';
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

const brepVector3Schema = z.tuple([
  brepScalarSchema,
  brepScalarSchema,
  brepScalarSchema,
]);

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

/**
 * AI SDK defaults to reference-free JSON Schema conversion so providers that
 * require OpenAPI-like schemas can consume ordinary Zod inputs. M1 scalar
 * expressions are genuinely recursive (`z.lazy`), so reference-free
 * conversion would replace recursive operands with `{}` / `any` and weaken
 * the model-facing tool contract. Keep the original Zod schema authoritative
 * for validation, but opt this provider-facing wrapper into JSON references.
 */
export const brepAiBuildProviderInputSchema = zodSchema(
  brepAiBuildInputSchema,
  { useReferences: true },
);

export const brepAiBuildOutputSchema = z
  .object({
    status: z.literal('success'),
    message: z.string().min(1),
  })
  .strict();

export type BrepAiBuildInput = Omit<
  z.infer<typeof brepAiBuildInputSchema>,
  'project'
> & { project: BrepProject };
export type BrepAiBuildOutput = z.infer<typeof brepAiBuildOutputSchema>;