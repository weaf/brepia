# Brepia AI Provider Registry Skill

## Purpose

Guide implementation of custom AI provider support while preserving existing upstream provider routing and security properties.

## Architecture Principles

### Built-in Providers Remain Source/Env Managed

- Built-in providers (Anthropic, Google, OpenRouter, local OpenAI-compatible, OpenCode, CLI agents) are configured via environment variables and static code.
- Do NOT convert built-in providers into database rows.
- Do NOT modify `providerFor()`, `createChatProviders()`, or `buildChatModel()` routing logic unless the plan explicitly requires it.

### Custom Providers Are Additive

- Custom providers are user-owned, stored in `ai_providers` table.
- They are resolved at runtime by the server, merged into the provider routing alongside built-in providers.
- Custom provider IDs are user-owned and namespaced (e.g., `<slug>/<model_id>`).

### Provider Secrets Are Server-Only

- API keys, tokens, and credentials are encrypted and stored server-side.
- Never log API keys, tokens, or authorization headers.
- Never return credential columns in API responses to the client.
- Never include credentials in error messages or browser console output.

## Must Do

1. **Validate URLs** — Reject unsupported protocols (`file://`, `data://`, etc.). Only `https://` and `http://` (localhost only) are allowed.
2. **Bounded timeouts** — Test connection with a bounded timeout (e.g., 5 seconds), not an infinite wait.
3. **No silent fallback** — If a custom provider fails, fail explicitly with a useful error. Do NOT silently fall back to another provider.
4. **Explicit capability metadata** — Each provider model's capabilities (vision, tool-use, etc.) must be explicitly set, not inferred.
5. **Stable model IDs** — Model IDs stored in conversations remain stable regardless of provider configuration changes.
6. **Reserved prefixes** — Custom slugs must NOT impersonate built-in prefixes:
   - `anthropic`, `google`, `openai`, `openrouter`, `local`, `opencode`, `agent`

## Must NOT Do

- Log API keys, tokens, or authorization headers at any level (debug, info, error).
- Return plaintext credentials in any API response or error message.
- Silent fallback to another provider when a custom provider fails.
- Modify built-in provider routing unless the plan explicitly requires it.
- Store credentials in plaintext.
- Allow custom slugs that conflict with reserved prefixes.
- Infer model capabilities from provider type — always be explicit.

## Provider Driver Mapping

| Driver              | Description                | Runtime              |
| ------------------- | -------------------------- | -------------------- |
| `openai-compatible` | OpenAI-compatible chat API | `@ai-sdk/openai`     |
| `anthropic`         | Anthropic Claude API       | `@ai-sdk/anthropic`  |
| `google`            | Google Gemini API          | `@ai-sdk/google`     |
| `openrouter`        | OpenRouter API             | `@ai-sdk/openrouter` |

## Preset Convenience

Presets (`ollama`, `llama-swap`, `lm-studio`, `custom`) are UI conveniences that set default values for `base_url`, `driver`, and common headers. They do NOT determine runtime behavior — the `driver` field does.

## API Response Security

When returning provider data to the client, always exclude credential columns:

```typescript
// SAFE — exclude credential columns
const safeProviders = providers.map(
  ({
    id,
    user_id,
    slug,
    name,
    driver,
    preset,
    base_url,
    enabled,
    headers,
    created_at,
    updated_at,
  }) => ({
    id,
    slug,
    name,
    driver,
    preset,
    base_url,
    enabled,
    headers,
    created_at,
    updated_at,
  }),
);

// UNSAFE — never do this
const unsafeProviders = providers; // includes credential_ciphertext, credential_iv, credential_tag
```

## Error Handling

When a custom provider fails:

1. Log the error message (NOT credentials).
2. Return a structured error to the client: `{ error: 'Provider unavailable', provider: '<slug>', details: '<message>' }`.
3. Do NOT attempt to retry with a different provider.
