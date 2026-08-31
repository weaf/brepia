import { z } from 'zod';

const runtimeModelIdSchema = z.string().trim().min(1).max(512);
const nullableRuntimeModelIdSchema = z.union([runtimeModelIdSchema, z.null()]);

export const CreativeImageProviderSchema = z.enum(['openai', 'fal']);
export type CreativeImageProvider = z.infer<typeof CreativeImageProviderSchema>;
const nullableCreativeImageProviderSchema = z.union([
  CreativeImageProviderSchema,
  z.null(),
]);

export const CreativeRuntimeModelRoutingSchema = z.object({
  creativeImagePrimaryProvider:
    nullableCreativeImageProviderSchema.default(null),
  creativeImageFallbackProvider:
    nullableCreativeImageProviderSchema.default(null),
  openAiOrchestratorModelId: nullableRuntimeModelIdSchema.default(null),
  openAiImageModelId: nullableRuntimeModelIdSchema.default(null),
  falImageTextModelId: nullableRuntimeModelIdSchema.default(null),
  falImageReferenceModelId: nullableRuntimeModelIdSchema.default(null),
  nativeImageModelId: nullableRuntimeModelIdSchema.default(null),
  nativeMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falUltraMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falCaptionModelId: nullableRuntimeModelIdSchema.default(null),
  falSegmentationModelId: nullableRuntimeModelIdSchema.default(null),
  falQualityMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falFastMeshModelId: nullableRuntimeModelIdSchema.default(null),
  falPreviewMeshModelId: nullableRuntimeModelIdSchema.default(null),
});

export type CreativeRuntimeModelRouting = z.infer<
  typeof CreativeRuntimeModelRoutingSchema
>;

export const UpdateCreativeRuntimeModelRoutingSchema =
  CreativeRuntimeModelRoutingSchema.partial();

export const EMPTY_CREATIVE_RUNTIME_MODEL_ROUTING: CreativeRuntimeModelRouting =
  CreativeRuntimeModelRoutingSchema.parse({});

export type CreativeRuntimeModelKey = Exclude<
  keyof CreativeRuntimeModelRouting,
  'creativeImagePrimaryProvider' | 'creativeImageFallbackProvider'
>;

export function requireCreativeRuntimeModel(
  routing: CreativeRuntimeModelRouting,
  key: CreativeRuntimeModelKey,
): string {
  const value = routing[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      `Creative runtime model ${key} is not configured. Select it in AI Settings > Model routing.`,
    );
  }
  return value.trim();
}
