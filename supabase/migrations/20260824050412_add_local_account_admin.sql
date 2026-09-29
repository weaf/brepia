
  create table "public"."registration_settings" (
    "id" smallint not null default 1,
    "allow_registration" boolean not null default false,
    "require_admin_approval" boolean not null default true,
    "identity_policy" text not null default 'email'::text,
    "allowed_social_providers" text[] not null default ARRAY['google'::text],
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."registration_settings" enable row level security;


  create table "public"."user_accounts" (
    "user_id" uuid not null,
    "username" text,
    "contact_email" text,
    "role" text not null default 'user'::text,
    "status" text not null default 'active'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_accounts" enable row level security;

CREATE UNIQUE INDEX registration_settings_pkey ON public.registration_settings USING btree (id);

CREATE UNIQUE INDEX user_accounts_pkey ON public.user_accounts USING btree (user_id);

CREATE UNIQUE INDEX user_accounts_username_lower_key ON public.user_accounts USING btree (lower(username)) WHERE (username IS NOT NULL);

alter table "public"."registration_settings" add constraint "registration_settings_pkey" PRIMARY KEY using index "registration_settings_pkey";

alter table "public"."user_accounts" add constraint "user_accounts_pkey" PRIMARY KEY using index "user_accounts_pkey";

alter table "public"."registration_settings" add constraint "registration_settings_identity_policy_check" CHECK ((identity_policy = ANY (ARRAY['email'::text, 'social'::text, 'email_or_social'::text]))) not valid;

alter table "public"."registration_settings" validate constraint "registration_settings_identity_policy_check";

alter table "public"."registration_settings" add constraint "registration_settings_singleton_check" CHECK ((id = 1)) not valid;

alter table "public"."registration_settings" validate constraint "registration_settings_singleton_check";

alter table "public"."user_accounts" add constraint "user_accounts_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'user'::text]))) not valid;

alter table "public"."user_accounts" validate constraint "user_accounts_role_check";

alter table "public"."user_accounts" add constraint "user_accounts_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'disabled'::text]))) not valid;

alter table "public"."user_accounts" validate constraint "user_accounts_status_check";

alter table "public"."user_accounts" add constraint "user_accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."user_accounts" validate constraint "user_accounts_user_id_fkey";

alter table "public"."user_accounts" add constraint "user_accounts_username_check" CHECK (((username IS NULL) OR (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'::text))) not valid;

alter table "public"."user_accounts" validate constraint "user_accounts_username_check";

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
$function$
;

grant references on table "public"."registration_settings" to "anon";

grant trigger on table "public"."registration_settings" to "anon";

grant truncate on table "public"."registration_settings" to "anon";

grant references on table "public"."registration_settings" to "authenticated";

grant trigger on table "public"."registration_settings" to "authenticated";

grant truncate on table "public"."registration_settings" to "authenticated";

grant references on table "public"."registration_settings" to "service_role";

grant trigger on table "public"."registration_settings" to "service_role";

grant truncate on table "public"."registration_settings" to "service_role";

grant references on table "public"."user_accounts" to "anon";

grant trigger on table "public"."user_accounts" to "anon";

grant truncate on table "public"."user_accounts" to "anon";

grant references on table "public"."user_accounts" to "authenticated";

grant trigger on table "public"."user_accounts" to "authenticated";

grant truncate on table "public"."user_accounts" to "authenticated";

grant references on table "public"."user_accounts" to "service_role";

grant trigger on table "public"."user_accounts" to "service_role";

grant truncate on table "public"."user_accounts" to "service_role";


  create policy "Users can view their own account access"
  on "public"."user_accounts"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) = user_id));


CREATE TRIGGER update_registration_settings_updated_at BEFORE UPDATE ON public.registration_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_accounts_updated_at BEFORE UPDATE ON public.user_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


