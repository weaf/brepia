# Creative model profiles plan

Status: **Phase 1 complete and merged; Phase 2 implementation in progress on `feature/creative-profile-pinning`**

## Product direction

Brepia should be local-first for Creative generation. A fresh/local installation should not present hosted-vendor routing as if it were required infrastructure. Local operators should see the Creative runtimes they actually installed, be able to save multiple compatible local configurations, and choose the active/default profile explicitly.

Hosted providers remain optional integrations. They appear only when a compatible Creative provider adapter is explicitly enabled.

## Phase 1 — Local Creative profiles and discovery

Goals:

- [x] Add persisted local Creative profile schema under `model_routing`.
- [x] Keep adapter/protocol identity separate from concrete model IDs.
- [x] Discover native Creative runtime candidates live from llama-swap `/v1/models`.
- [x] Keep `creative/*` models out of the normal chat/Parametric Local Models catalog.
- [x] Make a removed/Not configured model selectable again through discovery.
- [x] Allow exact custom runtime model IDs without turning them into hidden defaults.
- [x] Support multiple saved local profiles.
- [x] Let a profile be incomplete/disabled while being configured.
- [x] Require an enabled mesh runtime before a profile can become default.
- [x] Show the selected local profile beneath Default models → Creative.
- [x] Preserve existing explicit native model selection through a data migration that copies persisted values rather than naming a concrete model in SQL.
- [x] Hide vendor-specific hosted routing in deployments where no hosted Creative adapter is enabled.
- [x] Preserve existing hosted adapter compatibility when it is explicitly enabled.
- [x] Store generation resolution and long-running conditioning/mesh timeouts on each Local Creative profile.
- [x] Make the native Creative transport honor the profile timeout rather than Node/Undici's shorter implicit response-header timeout.
- [x] Verify live 1024 TRELLIS.2 generation through completion beyond the previous five-minute cutoff.

Compatibility implementation:

- `local/native` remains the stable local Creative backend identity.
- `defaultLocalCreativeProfileId` selects a named local profile.
- During Phase 1, the selected profile is materialized into the existing `nativeImageModelId` / `nativeMeshModelId` runtime slots so the native generation path keeps the existing backend contract.
- Existing profiles that predate per-profile runtime settings receive schema defaults of 1024 resolution, 10 minutes for conditioning-image generation and 30 minutes for mesh generation.
- The older generic `creative.*` runtime settings remain fallback inputs only when no usable Local Creative profile exists; profile settings take precedence when a profile is active.

## Live timeout finding

The first 1024 TRELLIS.2 regression run exposed a pre-existing transport mismatch rather than a model/profile failure:

- llama-swap discovered and started both configured Creative runtimes;
- conditioning image generation completed successfully;
- TRELLIS.2 `/health` returned `200 OK` and llama-swap reported the model as `ready`;
- the mesh request was logged by llama-swap as HTTP `499` after approximately five minutes;
- pCAD had configured `creative.meshGenerationTimeoutMs = 1800000`, but the Node fetch transport stopped waiting for response headers at the shorter implicit timeout.

Native Creative conditioning and mesh calls therefore use an explicit long-running Node HTTP transport whose total abort signal comes from the selected profile. This keeps the timeout model-specific and avoids globally extending unrelated HTTP requests.

## Phase 2 — Conversation profile pinning

Implementation goals:

- [x] Pin the current Local Creative default profile ID when a new Creative conversation is created.
- [x] Resolve native runtime models and runtime settings from the pinned profile rather than only the current global active profile.
- [x] Preserve legacy conversations without a profile key using the existing compatibility routing behavior.
- [ ] Add an explicit per-conversation local profile selector if live switching is desirable.
- [x] Ensure changing the default profile affects only new conversations unless the user explicitly changes an existing conversation.

### Persistence semantics

`conversations.settings.localCreativeProfileId` is the conversation-level pin.

- Declarative database source is the Creative pinning function/trigger section in `supabase/schemas/triggers.sql`; the migration must be generated from it with the repository-local `npx supabase db diff` workflow.
- New Creative conversations receive the current `defaultLocalCreativeProfileId` in a `BEFORE INSERT` database trigger. This keeps pinning consistent for every client that creates a conversation rather than relying on one React view.
- The trigger always writes the key for new Creative conversations. A JSON `null` value records that no Local Creative profile was selected at creation time.
- Existing conversations are not backfilled. Absence of the key therefore remains an unambiguous legacy marker and preserves Phase-1 compatibility behavior.
- No new conversation table column is required; the existing typed `settings` JSON is the intended home for other pinned conversation choices as well.

### Runtime semantics

- A string pin resolves exactly that Local Creative profile from the user's current profile catalog.
- The pinned profile supplies the conditioning-image model, mesh model, resolution and per-stage timeouts as one coherent runtime configuration. Native generation does not borrow missing model IDs from another active/default profile.
- A profile's `enabled` flag controls whether it can be selected for new/default usage. An already-pinned conversation may continue to use a disabled profile while the profile still exists and remains structurally usable.
- Deleting a pinned profile or removing its mesh runtime fails closed with an actionable configuration error instead of silently retargeting the conversation.
- A new conversation pinned to `null` does not adopt a Local Creative profile if the user later changes the global default; starting a new Creative conversation is required until a per-conversation selector exists.
- A legacy conversation with no pin key continues following the current explicit default/compatibility routing, matching Phase 1.

## Phase 3 — Provider adapter management

Provider configuration should become capability-driven rather than a permanent list of vendor fields.

- [ ] Define Creative provider adapter metadata/capabilities in one registry.
- [ ] Surface only adapters installed/enabled for the deployment.
- [ ] Let users configure credentials/model IDs for those adapters after activation.
- [ ] Allow future providers without adding them to the default local Settings surface.
- [ ] Keep provider protocol/auth/request differences inside adapters; do not pretend an arbitrary model ID alone makes an incompatible provider usable.

## Non-goals

- Do not change Parametric model routing.
- Do not change the Creative controller LLM selection.
- Do not alter stable-runtime lifecycle/recovery behavior.
- Do not rename `local/native` or compatibility-sensitive historical Creative backend aliases in unrelated cleanup.
- Do not remove working hosted adapter code merely to simplify the local UI.

## Verification gate

Before merge:

```bash
npm ci
npm test
npm run typecheck
npm run lint -- --max-warnings 0
npm run build
git diff --check
```

Phase 2 local database preparation:

```bash
npx supabase db diff -f creative_conversation_profile_pinning
# review the generated migration
npx supabase migration up
npx supabase gen types typescript --local > shared/database.ts
```

Phase 2 local/live verification should then confirm:

1. The generated migration contains only the intended Creative conversation pin trigger/function changes.
2. Create Creative conversation A while profile A is the default and verify `settings.localCreativeProfileId` is A.
3. Change the global default to profile B.
4. Continue conversation A and verify native Creative logs still report profile A and its resolution/timeouts/model IDs.
5. Create conversation B and verify it pins profile B.
6. Confirm a pre-Phase-2 Creative conversation with no pin key still works through compatibility routing.
7. Confirm text → 3D and reference-image → 3D remain functional.
8. Confirm stable-runtime/background/reconnect behavior is unchanged during a long native generation.
