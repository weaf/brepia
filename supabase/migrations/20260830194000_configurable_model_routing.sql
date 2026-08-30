ALTER TABLE public.user_ai_preferences
  ADD COLUMN IF NOT EXISTS model_routing jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_ai_preferences.model_routing IS
  'User-configurable low-level runtime model IDs and provider routing. Runtime code must not inject hidden model defaults.';

-- Preserve the behavior existing users had before runtime model IDs became
-- explicit settings. These values are migration history only; new users get an
-- empty routing object and must configure the runtime models they intend to use.
UPDATE public.user_ai_preferences
SET model_routing = jsonb_build_object(
  'creativeImagePrimaryProvider', 'openai',
  'creativeImageFallbackProvider', 'fal',
  'openAiOrchestratorModelId', 'gpt-5.4',
  'openAiImageModelId', 'gpt-image-2',
  'falImageTextModelId', 'fal-ai/flux-pro/v1.1',
  'falImageReferenceModelId', 'fal-ai/flux-pro/kontext/max/multi',
  'nativeImageModelId', 'creative/z-image-turbo',
  'nativeMeshModelId', 'creative/trellis2',
  'falUltraMeshModelId', 'fal-ai/meshy/v6-preview/image-to-3d',
  'falCaptionModelId', 'fal-ai/moondream3-preview/caption',
  'falSegmentationModelId', 'fal-ai/sam-3/image',
  'falQualityMeshModelId', 'fal-ai/sam-3/3d-objects',
  'falFastMeshModelId', 'tripo3d/tripo/v2.5/image-to-3d',
  'falPreviewMeshModelId', 'fal-ai/hunyuan3d/v2/mini/turbo'
)
WHERE model_routing = '{}'::jsonb;

-- The old code used these two model IDs as hidden defaults. Persist them for
-- existing preference rows so behavior survives the migration without keeping
-- those IDs in runtime source code. New preference rows remain unconfigured.
UPDATE public.user_ai_preferences
SET default_parametric_model_id = 'openai/gpt-5.6-sol'
WHERE default_parametric_model_id IS NULL;

UPDATE public.user_ai_preferences
SET default_creative_model_id = 'local/trellis2'
WHERE default_creative_model_id IS NULL;
