# Brepia remake — status and audit

Branch: `feature/brepia-remake`  
Base: `967f744976d3ae2fb64f3681745c8c046345499a`  
Last updated: 2026-08-27

Companion plan: `docs/brepia_remake_plan.md`  
Brand maintenance note: `docs/brepia_branding.md`

## Current checkpoint

Immediately before this status commit, the branch was **121 commits ahead of `master`, 0 behind**. It remains a linear descendant of the recorded master base.

The Brepia presentation implementation is now substantially complete. The previously blocked legal/contact/community problem has been resolved architecturally by treating Brepia as open-source software and moving deployment-specific public identity into administrator-controlled **Instance identity** settings.

Remaining work is primarily real-environment migration/validation, visual review, npm-generated cleanup, and the intentionally deferred `CADAM Original` prompt-profile decision.

## Local environment note — NOx owns Supabase lifecycle

On the current pCAD/Brepia development workstation, the local Supabase services are started/stopped through **NOx**.

- Do not assume a global `supabase` executable exists.
- Do not use `supabase start`, `supabase stop`, `npx supabase start` or `npx supabase stop` as the normal lifecycle.
- Start the local Supabase stack through NOx first.
- Once NOx has started the stack, repository-local Supabase CLI operations may be run through `npx`, for example:

```bash
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Repository-level agent guidance is recorded in `AGENTS.md` so future chats/coding agents do not replace the NOx-managed environment with a standalone Supabase lifecycle.

## Completed product work

- [x] Brepia product/brand concept and rename boundaries recorded.
- [x] Shared `BrepiaMark`, `BrepiaBrand` and `ActivityIndicator` implemented.
- [x] Browser title/meta/favicon/web manifest migrated to Brepia.
- [x] Desktop/mobile sidebar primary branding migrated.
- [x] Auth/password surfaces migrated.
- [x] Home/start copy uses rotating Brepia-specific prompts.
- [x] Upstream Adam product banner removed.
- [x] Assistant/prompt identity directly uses Brepia components.
- [x] Main indeterminate activity language migrated away from inherited spinners/Lottie.
- [x] Generated GIF watermark and GLB point transition migrated.
- [x] Export UI and generated MTL branding migrated.
- [x] README/contributor/benchmark current-product presentation migrated.
- [x] Hardcoded CADAM Discord ownership removed.
- [x] Inherited AdamCAD pseudo-SaaS Terms/Privacy text removed.
- [x] Code-of-Conduct contact no longer points to upstream `zach@adam.new`.
- [x] Final runtime CADAM logo asset removed.
- [x] Obsolete upstream banner/vendor artwork and legacy screenshots removed.

## Instance identity architecture

### Why it exists

Brepia is currently an **open-source project**, not one centrally operated service. A fresh installation must therefore not claim that Brepia/Noty/another entity is the legal operator, support contact or community owner.

Default behavior is deliberately neutral:

```text
operatorName = null
contactEmail = null
communityUrl = null
showCommunityLink = false
legalPagesEnabled = false
termsUrl = null
privacyUrl = null
```

### Database

Added migration:

`supabase/migrations/20260827062000_instance_identity_settings.sql`

and declarative schema:

`supabase/schemas/instance_settings.sql`

The singleton `public.instance_settings` stores:

- operator/organization name;
- public contact email;
- community label/URL + visibility toggle;
- legal-link visibility toggle;
- Terms URL;
- Privacy URL.

Security model:

- RLS enabled;
- direct `anon`/`authenticated` table access revoked;
- service role gets only required table access;
- browser clients read through the application API, not directly from the table.

`supabase/schemas/triggers.sql` includes the matching `updated_at` trigger.

### Server/API

`src/server/instanceIdentity.ts`

- owns defaults and normalization;
- validates contact email;
- accepts only HTTP/HTTPS public URLs;
- trims/limits text fields;
- refuses to expose the community toggle without a URL;
- reads/writes the singleton using the server service-role client.

The generated `shared/database.ts` has not been manually rewritten for this new table. Until real Supabase type regeneration is run, the server module uses a deliberately isolated minimal typed adapter for `instance_settings`.

`src/routes/api/settings/instanceIdentity.ts`

- `GET` is public by design and returns only the whitelisted presentation DTO;
- `PUT` requires an authenticated active administrator;
- invalid inputs receive explicit validation errors;
- no secret/admin-only configuration is part of the public DTO.

`src/services/instanceIdentityService.ts` owns the client-side Zod contract.

### Admin UI

`src/components/settings/InstanceIdentitySettingsSection.tsx`

Admin-only controls:

- Operator / organization
- Public contact email
- Show community link
- Community label
- Community URL
- Show legal links
- Terms URL
- Privacy URL

`SettingsView.tsx` now includes this section next to the existing admin/AI settings surfaces.

### Community behavior

`Sidebar.tsx` no longer contains the inherited CADAM Discord invite.

A community button appears only when the administrator has both:

1. configured a valid community URL; and
2. enabled `showCommunityLink`.

The button is generic (`MessageCircle`) and takes its label from instance settings, so it can represent Discord, a forum, Matrix or another community without product-specific hardcoding.

### Legal behavior

The old AdamCAD Terms/Privacy documents named AdamCAD as operator/controller and supplied `hello@adamcad.com`. Those statements were not valid for a generic Brepia open-source installation and have been removed.

`src/components/legal/InstanceLegalNotice.tsx` now provides neutral open-source information:

- Brepia does not ship one hosted-service legal identity for every installation;
- if an administrator has configured an external Terms/Privacy document and enabled legal links, the page links to it;
- configured operator/contact information may be displayed;
- source-code licensing is explicitly separated from deployment/operator terms.

`TermsOfServiceView.tsx` and `PrivacyPolicyView.tsx` are now small wrappers around this neutral notice.

`src/components/settings/InstanceLegalLinks.tsx` shows optional external legal links in Settings only when enabled/configured.

`public/cadam-logo.svg` was deleted after its final legal-page consumers disappeared.

### Code of Conduct

`CODE_OF_CONDUCT.md` no longer directs reports to an upstream Adam email address. It instructs reporters to use a private channel published by the maintainers/project, and to request a private reporting method without exposing incident details if none is published.

Runtime Instance identity and repository Code-of-Conduct reporting remain intentionally separate concepts.

## Brand system

### React components

`src/components/brand/`

- `BrepiaMark` — open node-based wireframe/B-Rep mark;
- `BrepiaBrand` — mark + `BREPIA` with optional `by Noty`;
- `ActivityIndicator` — quiet pulsing indeterminate state with reduced-motion support.

### Current public Brepia assets

- `public/brepia-mark.svg`
- `public/brepia-logo.svg`
- `public/brepia-watermark.svg`
- `public/site.webmanifest`

Exact mark geometry, spacing and accent remain subject to real visual review.

## Home/start

`src/lib/homePromptCopy.ts` owns the rotating start copy:

- `Bring your idea to life with Brepia...`
- `Shape your idea with Brepia...`
- `Turn an idea into geometry with Brepia...`
- `Create something new with Brepia...`
- `What will you create with Brepia?`

One line is selected per mount and immediate repeats are avoided via `sessionStorage`.

`tests/homePromptCopy.test.ts` exists but has not yet been executed in the real project environment.

## Activity migration

The previously tracked simple waits in these major surfaces are migrated to `ActivityIndicator`:

- application/auth bootstrap;
- auth/password/registration;
- SCAD/GitHub import;
- TextAreaChat;
- assistant loading;
- MessageBubble image/tool/preview waits;
- image/GIF/GLB/OpenSCAD viewers;
- settings/admin/provider/model/vision waits;
- public share loading;
- desktop/mobile parametric export;
- creative mesh download/print;
- EditorView bootstrap;
- editor streaming preview.

Determinate progress, especially GIF generation percentages, remains determinate.

The old Lottie loader and `src/assets/adam-loading.json` are removed. `lottie-react` appears unused but dependency/lockfile removal is intentionally deferred until npm can regenerate the lockfile in the real project environment.

## Generated media and export branding

- GIF live overlay + baked frames use `brepia-watermark.svg`.
- GLB transition uses `src/utils/brepiaLogoVertices.ts`.
- old `src/utils/adamLogoVertices.ts` is removed.
- exported `.mtl` metadata says `Generated by Brepia`.
- Mandarin3D `external_source = adam-<mesh-id>` remains as an existing integration identifier.

## Documentation/current presentation

Current Brepia presentation is established in:

- `README.md`
- `CONTRIBUTING.md`
- `benchmarks/README.md`
- benchmark render-script comments
- `docs/brepia_branding.md`
- remake plan/status.

Historical/technical documents may retain CADAM/pCAD wording when it accurately records history or compatibility. Do not mass-rewrite them.

## Legacy assets removed

Removed after consumers migrated or were deleted:

- CADAM launch/favicons/logo assets;
- Adam logo variants and icon;
- old GitHub banners;
- Adam Lottie loading JSON;
- Adam logo vertex geometry;
- temporary logo compatibility aliases;
- `fusion.svg`, `solidworks.svg`, `onshape.png` used only by the deleted upstream product banner;
- old `screenshot-1.jpeg`, `screenshot-2.jpeg`, `screenshot-3.jpeg` no longer used by Brepia documentation;
- dead `DiscordIcon` after community navigation became generic.

## Prompt-profile migration — intentionally last

`src/components/settings/PromptProfilesSettings.tsx` still exposes `CADAM Original`.

This remains intentionally untouched until the rest of the remake is validated. It participates in real profile lineage semantics:

- built-in prompt overlays;
- base revision/fingerprint tracking;
- fork lineage;
- stale-fork warnings;
- built-in profile/API semantics.

At the end, inspect the actual built-in prompt and decide whether to:

1. preserve an explicitly inherited/upstream profile;
2. rename display identity only; or
3. introduce a genuine Brepia built-in revision and migrate displayed lineage.

Internal IDs need not change solely because display identity changes.

## Internal identifiers deliberately preserved

### Deployment

- Vite/router/output compatibility base remains `/cadam`.

### External integrations

- Sentry `org/project = adamcad` remains until the actual external resource is migrated.
- Mandarin3D `external_source = adam-*` remains an integration identifier.

### CSS/theme

- `bg-adam-*`, `text-adam-*`, `border-adam-*` and related tokens remain implementation identifiers.

### pCAD compatibility/ops

Examples deliberately retained:

- `PCAD_STEP_EXPORT_*`
- `pcad-scad2step-sandbox`
- `.opencode/agents/pcad-*`
- `.opencode/skills/pcad-*`
- `@pcad.invalid`
- compatibility-sensitive DB/storage/localStorage identifiers.

## Package metadata deferred cleanup

`package.json` still has inherited starter metadata and still declares `lottie-react` even though the Lottie runtime consumer is gone.

Do not hand-edit the large lockfile through a cosmetic GitHub pass. Perform package-name/dependency cleanup with npm in the actual project environment and commit the generated lockfile diff.

## Tests added but not yet executed

- `tests/homePromptCopy.test.ts`
- `tests/instanceIdentity.test.ts`

The instance test covers:

- neutral fresh-install defaults;
- whitespace/URL normalization;
- community visibility without URL;
- rejection of non-HTTP URLs;
- rejection of malformed contact emails.

No PASS claim is made yet.

## Required real-environment validation

First apply the new migration to the real development database:

```text
supabase/migrations/20260827062000_instance_identity_settings.sql
```

On the current workstation, start Supabase through NOx first; then use `npx supabase migration up` rather than trying to own the service lifecycle from the Supabase CLI.

Then verify:

- default GET is neutral;
- admin PUT persists settings;
- non-admin PUT is rejected;
- community appears/disappears correctly desktop/mobile;
- external legal links behave correctly;
- Terms/Privacy fallback remains neutral with no configuration.

Final project gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Also run real visual checks on desktop/mobile and relevant compact/light/dark states before merge.

The assistant shell/container previously could not resolve GitHub DNS, so no local test success is claimed from that environment. GitHub connector reads/writes continue to work.

## Recommended next order

1. Start the local Supabase stack through NOx and apply the Instance identity migration with the repository-local CLI.
2. Regenerate local Supabase types with `npx supabase gen types typescript --local > shared/database.ts`.
3. Run the Vite/TanStack generator so `src/routeTree.gen.ts` includes the Instance identity route.
4. Run focused/full tests, typecheck, lint and build; fix toolchain issues if any.
5. Perform desktop/mobile visual review and make small mark/spacing/accent adjustments.
6. Use npm to remove dead `lottie-react` and optionally rename private package metadata with a generated lockfile diff.
7. Resolve `CADAM Original` prompt-profile lineage/display **last**.
8. After the remake is stable, separately decide `weaf/pCAD` → `weaf/brepia` and any deployment path migration away from `/cadam`.

## Governing rule

> **Rebrand user-facing presentation while preserving compatibility identifiers and real behavioral semantics; deployment-specific identity belongs to the deployment administrator.**
