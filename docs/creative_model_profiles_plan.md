# Creative model profiles plan

Status: **Phase 1 implementation and live regression verification in progress on `feature/creative-model-profiles`**

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

Planned after Phase 1 regression verification:

- [ ] Pin local Creative profile ID when a new Creative conversation is created.
- [ ] Resolve native runtime models and runtime settings from the pinned profile rather than only the current global active profile.
- [ ] Preserve legacy conversations without a profile using the existing compatibility routing behavior.
- [ ] Add an explicit per-conversation local profile selector if live switching is desirable.
- [ ] Ensure changing the default profile affects only new conversations unless the user explicitly changes an existing conversation.

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

Live verification should then confirm:

1. Creative runtime discovery shows installed `creative/*` models.
2. Setting a runtime to Not configured does not make the discovered model disappear.
3. A local profile can be created, edited, enabled and selected as default.
4. Default models → Creative shows the concrete local profile/mesh ID.
5. Profile Advanced runtime settings persist resolution and conditioning/mesh timeout values.
6. A TRELLIS.2 generation lasting longer than five minutes remains connected until the profile's mesh timeout is reached or the GLB is returned.
7. Local Creative still generates text → 3D and reference-image → 3D with the selected profile.
8. Hosted provider-specific routing is absent in a local-only deployment.
9. Stable-runtime behavior remains unchanged while generation is in progress.
