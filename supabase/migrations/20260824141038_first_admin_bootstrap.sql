set check_function_bodies = off;

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
  bootstrap_requested boolean := COALESCE(NEW.raw_app_meta_data->>'pcad_bootstrap', 'false') = 'true';
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

  -- First-admin bootstrap is server-authorized and password/email only.
  -- A normal client signUp() cannot set raw_app_meta_data.pcad_bootstrap, so
  -- direct signups cannot claim administrator ownership of an empty install.
  IF is_first_user AND (auth_provider <> 'email' OR NOT bootstrap_requested) THEN
    RAISE EXCEPTION 'pcad_first_account_requires_bootstrap';
  END IF;

  -- A concurrent bootstrap request that loses the first-user race must fail
  -- rather than becoming a normal pending/active registration.
  IF bootstrap_requested AND NOT is_first_user THEN
    RAISE EXCEPTION 'pcad_bootstrap_unavailable';
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
$function$
;


