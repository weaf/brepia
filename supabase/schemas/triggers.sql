CREATE OR REPLACE FUNCTION "public"."update_conversation_leaf"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update conversations set 
    current_message_leaf_id = new.id,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

CREATE OR REPLACE TRIGGER "update_leaf_trigger" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_leaf"();

-- Generic updated_at trigger helper.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_previews_updated_at 
    BEFORE UPDATE ON "public"."previews" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_ai_preferences_updated_at
    BEFORE UPDATE ON "public"."user_ai_preferences"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_prompt_profiles_updated_at
    BEFORE UPDATE ON "public"."prompt_profiles"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ai_providers_updated_at
    BEFORE UPDATE ON "public"."ai_providers"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ai_provider_models_updated_at
    BEFORE UPDATE ON "public"."ai_provider_models"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_accounts_updated_at
    BEFORE UPDATE ON "public"."user_accounts"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_registration_settings_updated_at
    BEFORE UPDATE ON "public"."registration_settings"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Profile + pCAD account creation trigger for new Supabase users.
-- The first password/email identity is serialized with a transaction advisory
-- lock and becomes the initial active administrator. This prevents concurrent
-- first-registration attempts from creating multiple bootstrap admins.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  registration_enabled boolean := false;
  approval_required boolean := true;
  configured_identity_policy text := 'email';
  configured_social_providers text[] := ARRAY['google']::text[];
  auth_provider text := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  provider_allowed boolean := false;
  is_first_user boolean := false;
  initial_role text := 'user';
  initial_status text := 'pending';
  local_username text := NULL;
BEGIN
  -- Serialize the first-user decision. Concurrent auth.users inserts cannot
  -- both observe themselves as the sole committed account after this lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('pcad:first-admin'));

  SELECT count(*) = 1
  INTO is_first_user
  FROM auth.users;

  -- Bootstrap is deliberately password/email only. If a social identity is
  -- somehow invoked directly while the installation is empty, abort creation
  -- rather than orphaning the installation or granting social bootstrap admin.
  IF is_first_user AND auth_provider <> 'email' THEN
    RAISE EXCEPTION 'pcad_first_account_requires_password';
  END IF;

  SELECT
    allow_registration,
    require_admin_approval,
    identity_policy,
    allowed_social_providers
  INTO
    registration_enabled,
    approval_required,
    configured_identity_policy,
    configured_social_providers
  FROM public.registration_settings
  WHERE id = 1;

  IF NOT FOUND THEN
    registration_enabled := false;
    approval_required := true;
    configured_identity_policy := 'email';
    configured_social_providers := ARRAY['google']::text[];
  END IF;

  provider_allowed := CASE configured_identity_policy
    WHEN 'email' THEN auth_provider = 'email'
    WHEN 'social' THEN auth_provider <> 'email' AND auth_provider = ANY(configured_social_providers)
    WHEN 'email_or_social' THEN auth_provider = 'email' OR auth_provider = ANY(configured_social_providers)
    ELSE false
  END;

  IF is_first_user THEN
    initial_role := 'admin';
    initial_status := 'active';
  ELSIF registration_enabled AND provider_allowed AND NOT approval_required THEN
    initial_status := 'active';
  END IF;

  IF NEW.email LIKE '%@pcad.invalid' THEN
    local_username := split_part(NEW.email, '@', 1);
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );

  INSERT INTO public.user_accounts (
    user_id,
    username,
    contact_email,
    role,
    status
  )
  VALUES (
    NEW.id,
    local_username,
    CASE
      WHEN NEW.email LIKE '%@pcad.invalid' THEN NULL
      ELSE NEW.email
    END,
    initial_role,
    initial_status
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();