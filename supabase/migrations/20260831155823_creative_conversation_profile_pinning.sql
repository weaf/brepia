set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.pin_creative_profile_on_conversation_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  selected_profile_id text;
BEGIN
  IF NEW.type <> 'creative'::public."conversation-type" THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(
    btrim(preferences.model_routing ->> 'defaultLocalCreativeProfileId'),
    ''
  )
  INTO selected_profile_id
  FROM public.user_ai_preferences AS preferences
  WHERE preferences.user_id = NEW.user_id;

  -- Always write the key for new Creative conversations. JSON null is
  -- meaningful: it records that no Local Creative profile was selected at
  -- creation time, so a later default change cannot silently retarget this
  -- conversation. Server runtime distinguishes this from legacy rows where the
  -- key is absent.
  NEW.settings := COALESCE(NEW.settings, '{}'::jsonb)
    || jsonb_build_object('localCreativeProfileId', selected_profile_id);

  RETURN NEW;
END;
$function$
;

CREATE TRIGGER pin_creative_profile_on_conversation_insert BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.pin_creative_profile_on_conversation_insert();


