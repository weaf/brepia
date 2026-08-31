# Configurable model routing

## Goal

No concrete upstream model ID may be selected implicitly by runtime source code. User-facing product modes can remain stable abstractions, but the provider/model used by every low-level generation stage must be visible and editable in AI Settings.

## Architecture

- Existing Parametric and Creative default selectors remain the high-level conversation defaults.
- Existing Vision Fast/Deep selectors remain catalog-backed helper-model routing.
- `user_ai_preferences.model_routing` stores low-level Creative routing as JSONB.
- Local Creative is local-first: named profiles group the adapter/protocol, conditioning-image model and mesh model.
- Native Creative runtime model candidates are discovered live from llama-swap `/v1/models`; Brepia does not hardcode the installed model IDs.
- Missing low-level model configuration fails closed with an actionable Settings error; runtime code does not inject a hidden model.
- Existing users are migrated from their already-persisted native routing values into a local profile without changing the effective model IDs.
- Product mode IDs (`fast`, `quality`, `ultra`, native Creative backend identity) are contracts, not upstream model IDs, and remain stable.

## Local Creative profiles

A local profile contains:

- stable profile ID and user-facing name;
- adapter/protocol ID (`native-image-mesh-v1` initially);
- optional conditioning-image runtime model ID;
- mesh runtime model ID;
- enabled state.

`defaultLocalCreativeProfileId` identifies the selected local profile. During the compatibility phase, selecting that profile also materializes its two runtime IDs into the existing `nativeImageModelId` and `nativeMeshModelId` fields. This preserves the current native runtime contract while moving Settings and persistence toward profile-based model management.

The next profile-runtime phase may pin profile identity into Creative conversations so later default changes cannot alter an existing conversation's low-level runtime. Until that phase lands, the active local profile follows the existing global low-level routing semantics.

## Runtime discovery

The normal Local Models catalog intentionally excludes internal `creative/*` runtimes from chat/Parametric selection. Creative settings now query the same llama-swap deployment separately and expose those internal IDs as candidates for local Creative profiles.

Discovery is advisory rather than a hidden fallback:

- removing a selection does not remove the discovered model from the picker;
- a custom exact ID may still be entered;
- runtime health checks remain authoritative and fail if a configured model is not actually advertised/available.

## External Creative providers

Provider adapters remain compile-time/runtime capabilities, but they are no longer first-class controls in a local-only installation.

- Local Creative profiles never require OpenAI, fal.ai, or another hosted provider.
- Provider-specific low-level routing controls are shown only when a hosted Creative adapter is explicitly enabled for the deployment.
- Existing OpenAI/fal compatibility fields remain in the routing schema so an already-supported hosted adapter is not destroyed by the local-first UX change.
- Future hosted providers should be added through the provider-adapter boundary rather than by adding another unconditional group of vendor-specific fields to the default Settings experience.

Arbitrary providers cannot be made functional by entering a model name alone: image/mesh services have different protocols, authentication, request bodies and output contracts. A new provider therefore needs a compatible adapter, after which its models/settings can be user-configurable without changing the local profile architecture.

## Current routed hosted roles

These roles are compatibility/optional hosted-adapter configuration and are hidden when hosted Creative is not enabled:

- OpenAI Responses image orchestrator
- OpenAI image-generation model
- fal.ai text image model
- fal.ai reference/edit image model
- Ultra mesh model
- Quality caption model
- Quality segmentation model
- Quality mesh model
- Fast mesh model
- Preview mesh model

## Guardrail

`tests/modelRoutingHardcoding.test.ts` prevents historical concrete model IDs from being reintroduced into runtime source files, including Creative runtime discovery.

## Native backend identity

The selectable built-in Creative backend remains `local/native`. Historical model-specific backend IDs such as `local/trellis2` are compatibility aliases only. The actual local conditioning-image and mesh runtime model IDs come from the selected local Creative profile/settings, so changing the upstream model does not require changing conversation/backend identity.

## Installation profiles

Installation and runtime routing are intentionally separate concerns. An installation profile may pin concrete model artifacts, runtime versions, URLs, checksums and known-good llama-swap commands because the profile represents a tested, reproducible bootstrap package.

The current native Creative installer is the first such tested package. Its installed model IDs may be used to seed an initial configuration, but they are not runtime fallbacks and the application must not infer active models from the installation profile after setup. AI Settings remains authoritative for the models actually used at runtime.

As additional model/runtime combinations are tested, they can be added as versioned selectable installation profiles. Existing tested profiles should remain reproducible rather than silently changing their model versions. Operators may override a profile before installation or configure different compatible models afterward without changing the application runtime contract.
