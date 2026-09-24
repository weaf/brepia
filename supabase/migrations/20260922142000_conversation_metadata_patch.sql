-- Phase B1.1: generic conversation metadata writes must never replay a stale
-- current_message_leaf_id. Merge settings keys in the same row-level UPDATE so
-- concurrent settings changes do not overwrite unrelated keys.
CREATE OR REPLACE FUNCTION public.patch_conversation_metadata(
  p_conversation_id uuid,
  p_title text DEFAULT NULL,
  p_privacy public.privacy_type DEFAULT NULL,
  p_settings_patch jsonb DEFAULT '{}'::jsonb
) RETURNS SETOF public.conversations
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.conversations
  SET
    title = COALESCE(p_title, title),
    privacy = COALESCE(p_privacy, privacy),
    settings = COALESCE(settings, '{}'::jsonb) ||
      COALESCE(p_settings_patch, '{}'::jsonb)
  WHERE id = p_conversation_id
  RETURNING *;
$$;
