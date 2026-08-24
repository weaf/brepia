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
-- Existing users are treated as active by the server until an account row is
-- materialized, preserving backward compatibility during rollout.
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
  initial_status text := 'pending';
BEGIN
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

  IF registration_enabled AND provider_allowed AND NOT approval_required THEN
    initial_status := 'active';
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );

  INSERT INTO public.user_accounts (user_id, contact_email, status)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.email LIKE '%@pcad.invalid' THEN NULL
      ELSE NEW.email
    END,
    initial_status
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
