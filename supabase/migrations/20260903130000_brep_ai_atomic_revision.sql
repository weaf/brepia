CREATE OR REPLACE FUNCTION public.persist_brep_ai_revision(
  p_conversation_id uuid,
  p_expected_leaf_id uuid,
  p_message_id uuid,
  p_parts jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_leaf_id uuid;
BEGIN
  IF jsonb_typeof(p_parts) <> 'array' OR jsonb_array_length(p_parts) = 0 THEN
    RAISE EXCEPTION 'BRep AI revision parts must be a non-empty JSON array';
  END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'BRep AI revision metadata must be a JSON object';
  END IF;

  SELECT current_message_leaf_id
  INTO v_current_leaf_id
  FROM public.conversations
  WHERE id = p_conversation_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'conversation_not_found'
    );
  END IF;

  IF v_current_leaf_id IS DISTINCT FROM p_expected_leaf_id THEN
    RETURN jsonb_build_object(
      'accepted', false,
      'reason', 'stale',
      'currentLeafId', v_current_leaf_id
    );
  END IF;

  INSERT INTO public.messages (
    id,
    conversation_id,
    role,
    parts,
    metadata,
    parent_message_id,
    rating
  ) VALUES (
    p_message_id,
    p_conversation_id,
    'assistant',
    p_parts,
    COALESCE(p_metadata, '{}'::jsonb),
    p_expected_leaf_id,
    0
  );

  -- update_leaf_trigger runs inside this same transaction. Because the
  -- conversation row is already locked above, no competing leaf-changing
  -- transaction can interleave between the expected-leaf check and insert.
  RETURN jsonb_build_object(
    'accepted', true,
    'messageId', p_message_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.persist_brep_ai_revision(
  uuid, uuid, uuid, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_brep_ai_revision(
  uuid, uuid, uuid, jsonb, jsonb
) TO authenticated;
