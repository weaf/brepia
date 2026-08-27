create table if not exists "public"."instance_settings" (
  "id" smallint not null default 1,
  "operator_name" text,
  "contact_email" text,
  "community_url" text,
  "community_label" text not null default 'Community'::text,
  "show_community_link" boolean not null default false,
  "legal_pages_enabled" boolean not null default false,
  "terms_url" text,
  "privacy_url" text,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  constraint "instance_settings_pkey" primary key (id),
  constraint "instance_settings_singleton_check" check (id = 1)
);

alter table "public"."instance_settings" enable row level security;

-- Instance identity is administered through Brepia's server-side service-role
-- client. Browser roles never read the table directly; the public API exposes
-- only the explicitly whitelisted presentation fields.
revoke all on table "public"."instance_settings" from "anon";
revoke all on table "public"."instance_settings" from "authenticated";
grant select, insert, update on table "public"."instance_settings" to "service_role";

create trigger update_instance_settings_updated_at
before update on public.instance_settings
for each row execute function public.update_updated_at_column();
