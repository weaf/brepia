set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enforce_first_admin_bootstrap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  final_app_metadata jsonb;
  auth_provider text := 'email';
  bootstrap_requested boolean := false;
  is_first_user boolean := false;
BEGIN
  -- Serialize the final first-user decision. Concurrent bootstrap transactions
  -- cannot both commit as the initial administrator.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('pcad:first-admin'));

  SELECT raw_app_meta_data
  INTO final_app_metadata
  FROM auth.users
  WHERE id = NEW.id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  auth_provider := COALESCE(final_app_metadata->>'provider', 'email');
  bootstrap_requested :=
    COALESCE(final_app_metadata->>'pcad_bootstrap', 'false') = 'true';

  SELECT count(*) = 1
  INTO is_first_user
  FROM auth.users;

  IF is_first_user AND
     (auth_provider <> 'email' OR NOT bootstrap_requested) THEN
    RAISE EXCEPTION 'pcad_first_account_requires_bootstrap';
  END IF;

  IF bootstrap_requested AND NOT is_first_user THEN
    RAISE EXCEPTION 'pcad_bootstrap_unavailable';
  END IF;

  IF is_first_user THEN
    UPDATE public.user_accounts
    SET role = 'admin', status = 'active'
    WHERE user_id = NEW.id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'pcad_bootstrap_account_state_missing';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  registration_enabled boolean := false;
  approval_required boolean := true;
  configured_identity_policy text := 'email';
  configured_social_providers text[] := ARRAY['google']::text[];
  auth_provider text := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  provider_allowed boolean := false;
  initial_status text := 'pending';
  local_username text := NULL;
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
    'user',
    initial_status
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE CONSTRAINT TRIGGER enforce_first_admin_bootstrap_on_auth_user_created AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.enforce_first_admin_bootstrap();


