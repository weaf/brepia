# Brepia AI Provider Registry Skill

## Purpose

Guide custom AI-provider changes using Brepia's current provider registry, stable model IDs and credential/security boundaries.

## Current architecture

Custom providers are user-owned rows in:

- `ai_providers`
- `ai_provider_models`

Shared DTO/validation lives in `shared/aiSettings.ts`; stable custom model-ID helpers live in `shared/customModelIds.ts`; server-side CRUD, credential handling, connection testing and runtime model construction live in `src/server/customProviders.ts`.

Do not reconstruct provider behavior from historical settings plans when these modules define the live contract.

## Stable custom model IDs

Custom catalog IDs use:

```text
custom/<provider-uuid>/<provider-native-model-id>
```

The provider UUID is the stable namespace. Provider display names/slugs are mutable metadata and are not model identity.

Always use `makeCustomProviderModelId()` / `parseCustomProviderModelId()` rather than assembling or parsing custom IDs ad hoc. Provider-native model IDs may themselves contain `/`.

## Supported drivers

The current shared driver enum is:

| Driver | Runtime package |
| --- | --- |
| `openai-compatible` | `@ai-sdk/openai-compatible` |
| `anthropic` | `@ai-sdk/anthropic` |
| `google` | `@ai-sdk/google` |
| `openrouter` | `@openrouter/ai-sdk-provider` |

Do not add a driver in only one layer. Update shared validation, server runtime construction, UI and tests together.

## Provider secrets

Provider credentials are server-only and encrypted at rest by the existing AES-256-GCM implementation.

- The encryption key is supplied through `PCAD_CREDENTIAL_ENCRYPTION_KEY`.
- API DTOs expose credential presence (`hasCredential`) rather than the credential.
- Never log plaintext credentials, decrypted values or Authorization headers.
- Never return encrypted credential columns or plaintext credentials to the browser.
- Reuse the existing credential update/removal semantics rather than creating a second secret format.

## URL and connection-test security

Provider connection testing accepts user-controlled URLs and therefore uses the existing SSRF guard in `src/server/customProviders.ts`.

- Only HTTP(S) protocols are considered.
- Private, loopback, link-local, metadata/internal addresses are blocked by the current test-provider guard.
- DNS-resolved addresses are checked as part of the guard.
- Connection attempts use a bounded timeout.

Do not weaken or bypass this protection just to make a provider test pass. Any change to local/private provider testing requires an explicit security design, not a UI-only exception.

## Model capabilities

Custom model capability metadata is explicit (`supportsTools`, `supportsThinking`, `supportsVision`, context/output limits and visibility fields).

Do not infer capabilities from the driver or provider name. Preserve stored model identity even if a provider/model is later disabled or removed so historical conversations can fail explicitly rather than silently switching models.

## Routing behavior

Custom providers are additive to built-in provider/model routing.

- Do not silently fall back to a built-in provider when a selected custom provider/model is missing, disabled or fails.
- Keep provider/model ownership scoped to the authenticated user.
- Service-role queries must retain explicit user ownership constraints.
- Use the existing catalog/runtime helpers instead of inserting custom rows directly into a built-in catalog.

## Reserved slugs

Shared validation prevents custom provider slugs from impersonating built-in prefixes such as:

- `anthropic`
- `google`
- `openai`
- `openrouter`
- `local`
- `opencode`
- `agent`

Use the shared Zod schemas rather than duplicating this list in route/UI validation.

## Completion

For provider changes:

1. inspect shared validation, server runtime construction, catalog behavior and affected UI/API routes;
2. add/update focused tests for identity, auth/ownership, secrets, capabilities and failure behavior;
3. run:

   ```bash
   npm test
   npm run typecheck
   npm run lint
   npm run build
   git diff --check
   ```

4. verify the diff contains no secret exposure or silent fallback path.
