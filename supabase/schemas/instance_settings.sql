-- Brepia instance identity and optional public contact/community/social/legal links.
-- The table is server-managed. Public clients read a whitelisted DTO from the
-- application API instead of receiving direct database access.

CREATE TABLE IF NOT EXISTS "public"."instance_settings" (
    "id" smallint DEFAULT 1 NOT NULL,
    "operator_name" text DEFAULT NULL,
    "contact_email" text DEFAULT NULL,
    "community_url" text DEFAULT NULL,
    "community_label" text DEFAULT 'Community'::text NOT NULL,
    "show_community_link" boolean DEFAULT false NOT NULL,
    "discord_url" text DEFAULT NULL,
    "legal_pages_enabled" boolean DEFAULT false NOT NULL,
    "terms_url" text DEFAULT NULL,
    "privacy_url" text DEFAULT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "instance_settings_singleton_check" CHECK (("id" = 1)),
    CONSTRAINT "instance_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."instance_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."instance_settings" FROM "anon";
REVOKE ALL ON TABLE "public"."instance_settings" FROM "authenticated";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."instance_settings" TO "service_role";
