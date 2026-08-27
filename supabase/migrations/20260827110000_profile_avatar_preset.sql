ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "avatar_preset" "text" NULL;

COMMENT ON COLUMN "public"."profiles"."avatar_preset" IS
  'Optional Brepia avatar preset id. When set it takes precedence over provider/uploaded profile images in the application UI.';
