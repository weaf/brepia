# Configurable model routing

## Goal

No concrete upstream model ID may be selected implicitly by runtime source code. User-facing product modes can remain stable abstractions, but the provider/model used by every low-level generation stage must be visible and editable in AI Settings.

## Architecture

- Existing Parametric and Creative default selectors remain the high-level conversation defaults.
- Existing Vision Fast/Deep selectors remain catalog-backed helper-model routing.
- `user_ai_preferences.model_routing` stores low-level Creative routing as JSONB.
- AI Settings > Model routing exposes primary/fallback image providers and every current Creative runtime model ID.
- Missing low-level model configuration fails closed with an actionable Settings error; runtime code does not inject a hidden model.
- Existing users are migrated with their previous effective defaults so the architecture change does not silently alter behavior. New users start unconfigured for low-level runtime roles.
- Product mode IDs (`fast`, `quality`, `ultra`, native Creative backend identity) are contracts, not upstream model IDs, and remain stable.

## Current routed roles

- Native conditioning image runtime
- Native mesh runtime
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

`tests/modelRoutingHardcoding.test.ts` prevents the historical concrete model IDs from being reintroduced into runtime source files.

## Native backend identity

The selectable built-in Creative backend is `local/native`. Historical model-specific backend IDs such as `local/trellis2` are compatibility aliases only. The actual local conditioning-image and mesh runtime model IDs come from `modelRouting` settings, so changing the upstream model does not require changing conversation/backend identity.

The low-level Settings control is a model-ID combobox. Provider-specific APIs use different namespaces, so values are entered/selected explicitly rather than borrowing incompatible IDs from the chat/Parametric model catalog. Provider discovery can supply candidates to the same control later without adding runtime defaults.
