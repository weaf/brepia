-- Dynamic metadata overlay for models discovered from the built-in
-- Local OpenAI / llama-swap provider via GET /v1/models.
-- Model availability itself is runtime-discovered; this table stores only
-- user-authored capability/display preferences and never hardcodes model IDs.

BEGIN;

CREATE TABLE public.ai_local_model_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id text NOT NULL,
  display_name text,
  supports_tools boolean NOT NULL DEFAULT true,
  supports_thinking boolean NOT NULL DEFAULT false,
  supports_vision boolean NOT NULL DEFAULT false,
  context_limit integer,
  output_limit integer,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT ai_local_model_metadata_model_id_length
    CHECK (char_length(model_id) BETWEEN 1 AND 512),
  CONSTRAINT ai_local_model_metadata_context_limit_positive
    CHECK (context_limit IS NULL OR context_limit > 0),
  CONSTRAINT ai_local_model_metadata_output_limit_positive
    CHECK (output_limit IS NULL OR output_limit > 0)
);

CREATE UNIQUE INDEX ai_local_model_metadata_user_model_unique
  ON public.ai_local_model_metadata (user_id, model_id);

CREATE INDEX ai_local_model_metadata_user_id_idx
  ON public.ai_local_model_metadata (user_id);

ALTER TABLE public.ai_local_model_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_local_model_metadata_select"
  ON public.ai_local_model_metadata
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ai_local_model_metadata_insert"
  ON public.ai_local_model_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_local_model_metadata_update"
  ON public.ai_local_model_metadata
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_local_model_metadata_delete"
  ON public.ai_local_model_metadata
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT ALL ON TABLE public.ai_local_model_metadata TO authenticated;
GRANT ALL ON TABLE public.ai_local_model_metadata TO service_role;
GRANT ALL ON TABLE public.ai_local_model_metadata TO postgres;

COMMIT;
