-- Promote the existing explicit native Creative routing into a named local
-- Creative profile without changing the effective runtime model selection.
-- No concrete model ID is introduced here: values come from each user's
-- already-persisted routing settings.

UPDATE public.user_ai_preferences
SET model_routing = jsonb_set(
  jsonb_set(
    COALESCE(model_routing, '{}'::jsonb),
    '{localCreativeProfiles}',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'migrated-native',
        'name', 'Local Creative',
        'adapter', 'native-image-mesh-v1',
        'imageModelId', NULLIF(model_routing ->> 'nativeImageModelId', ''),
        'meshModelId', NULLIF(model_routing ->> 'nativeMeshModelId', ''),
        'enabled', true
      )
    ),
    true
  ),
  '{defaultLocalCreativeProfileId}',
  to_jsonb('migrated-native'::text),
  true
)
WHERE NULLIF(model_routing ->> 'nativeMeshModelId', '') IS NOT NULL
  AND CASE
    WHEN jsonb_typeof(model_routing -> 'localCreativeProfiles') = 'array'
      THEN jsonb_array_length(model_routing -> 'localCreativeProfiles') = 0
    ELSE true
  END;
