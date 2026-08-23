-- pCAD-local account authorization and registration policy.
-- Authentication remains owned by Supabase auth.users; these tables only add
-- pCAD-specific authorization and local-login metadata.

CREATE TABLE IF NOT EXISTS "public"."user_accounts" (
    "user_id" "uuid" NOT NULL,
    "username" "text" DEFAULT NULL,
    "contact_email" "text" DEFAULT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_accounts_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"]))),
    CONSTRAINT "user_accounts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'disabled'::"text"]))),
    CONSTRAINT "user_accounts_username_check" CHECK (("username" IS NULL) OR ("username" ~ '^[a-z0-9][a-z0-9._-]{2,31}$'::"text"))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_pkey ON "public"."user_accounts" USING btree (user_id);
ALTER TABLE "public"."user_accounts" ADD CONSTRAINT "user_accounts_pkey" PRIMARY KEY USING INDEX "user_accounts_pkey";

CREATE UNIQUE INDEX IF NOT EXISTS user_accounts_username_lower_key
    ON "public"."user_accounts" USING btree (lower(username))
    WHERE username IS NOT NULL;

ALTER TABLE "public"."user_accounts"
    ADD CONSTRAINT "user_accounts_user_id_fkey"
    FOREIGN KEY (user_id) REFERENCES auth.users(id)
    ON UPDATE CASCADE ON DELETE CASCADE not valid;
ALTER TABLE "public"."user_accounts" VALIDATE CONSTRAINT "user_accounts_user_id_fkey";

CREATE POLICY "Users can view their own account access"
    ON "public"."user_accounts"
    FOR SELECT
    USING ((SELECT "auth"."uid"()) = "user_id");

ALTER TABLE "public"."user_accounts" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "public"."registration_settings" (
    "id" smallint DEFAULT 1 NOT NULL,
    "allow_registration" boolean DEFAULT false NOT NULL,
    "require_admin_approval" boolean DEFAULT true NOT NULL,
    "identity_policy" "text" DEFAULT 'email'::"text" NOT NULL,
    "allowed_social_providers" "text"[] DEFAULT ARRAY['google'::"text"] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "registration_settings_singleton_check" CHECK (("id" = 1)),
    CONSTRAINT "registration_settings_identity_policy_check" CHECK (("identity_policy" = ANY (ARRAY['email'::"text", 'social'::"text", 'email_or_social'::"text"])))
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_settings_pkey ON "public"."registration_settings" USING btree (id);
ALTER TABLE "public"."registration_settings" ADD CONSTRAINT "registration_settings_pkey" PRIMARY KEY USING INDEX "registration_settings_pkey";

ALTER TABLE "public"."registration_settings" ENABLE ROW LEVEL SECURITY;
