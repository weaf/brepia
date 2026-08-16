# P04A — Prompt System Audit Findings

**Date**: 2026-08-16
**Task**: P04A — Audit current prompt system before P04B (built-in prompt + fingerprint)

---

## Current Architecture

### 1. Prompt Constants (src/server/aiChat.ts)

**PARAMETRIC_AGENT_PROMPT** (line 121, ~155 lines):

- Hardcoded system prompt for parametric conversations
- Defines Adam persona, build_parametric_model tool, answer_user tool, iteration rules, multi-feature checklists, OpenSCAD code rules, BOSL2 guidance, color rules, STL import rules, style example, anti-tool-talk rules

**CREATIVE_AGENT_PROMPT** (line 278, ~10 lines):

- Hardcoded system prompt for creative conversations
- Defines Adam as concise 3D mesh assistant, create_mesh tool, creative rules

### 2. systemPrompt Function (src/server/aiChat.ts:1036-1040)

```ts
function systemPrompt(conversation: ConversationAccess) {
  return conversation.type === 'creative'
    ? CREATIVE_AGENT_PROMPT
    : PARAMETRIC_AGENT_PROMPT;
}
```

- Simple ternary based on `conversation.type`
- No user customization, no profile selection, no overlay/fork logic
- Called as `system: systemPrompt(conversation)` in `streamText()` at line 1365

### 3. ConversationSettings (shared/types.ts:82-96)

```ts
type ConversationSettings = {
  model?: Model;
  suggestions?: string[];
  openCodeExecutionMode?: 'cli' | 'streaming';
} | null;
```

- **No `promptProfileId` field** — P04F will need to add this
- DB column `conversations.settings` is `jsonb` — no schema-level constraint
- Settings can be extended without DB migration (runtime type only)

### 4. Conversation Type (shared/types.ts:73-78)

```ts
type Conversation = Omit<
  Database['public']['Tables']['conversations']['Row'],
  'settings'
> & {
  settings: ConversationSettings;
};
```

- Two types: `'parametric'` and `'creative'`
- Type determines prompt, model, tools, and turn limits

---

## Gap Analysis (Current → P04 Requirements)

| Requirement               | Current State                   | Gap                                                         |
| ------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Immutable built-in prompt | Hardcoded constant in aiChat.ts | Works — constants can't be mutated by API                   |
| Prompt fingerprint        | None                            | **Missing** — need SHA-256 hash of prompt text              |
| Overlay profile           | None                            | **Missing** — no overlay/fork mechanism                     |
| Fork profile              | None                            | **Missing** — no fork profile concept                       |
| Default profile selection | None                            | **Missing** — no user preference for default                |
| Conversation pinning      | None                            | **Missing** — `promptProfileId` not in ConversationSettings |
| Runtime resolution        | systemPrompt(conversation) only | **Missing** — needs user ID + promptProfileId lookup        |
| Built-in edit protection  | N/A                             | **Missing** — API-level enforcement needed for P04B         |
| Edit original → clone     | N/A                             | **Missing** — API-level enforcement needed for P04C         |
| Upstream change detection | None                            | **Missing** — fingerprint comparison needed for P04G        |

---

## Key Integration Points

### Call Site

- `src/server/aiChat.ts:1365` — `system: systemPrompt(conversation)`
- This is the **only** place systemPrompt is called in the streaming path
- The streaming opencode path (`streamingOpencodeChatModel`) does NOT use systemPrompt — it uses its own internal prompt (opencode.ts:184-191)
  - This means P04E prompt resolution only affects direct model calls, not opencode streaming

### P01 Schema (Already Created)

- `prompt_profiles` table exists (migration 20260816135311)
- Fields: `id`, `user_id`, `name`, `content`, `mode` (overlay|fork), `is_default`, `is_archived`, `base_revision`, `created_at`, `updated_at`, `original_id`
- RLS enabled, `updated_at` trigger configured
- `original_id` references the built-in profile when forked/overlaid

### No Existing Usage

- `promptProfiles.ts` module exists (P02C) but only has CRUD — no profile resolution logic
- No route references `prompt_profiles` in the chat flow
- No conversation creation code sets a prompt profile

---

## Risk Areas

1. **Streaming opencode path** — `streamingOpencodeChatModel` in `opencode.ts` uses prompt instructions, not systemPrompt. P04E must handle this separately or acknowledge that opencode streaming has its own prompt mechanism.

2. **Conversation settings is nullable** — `ConversationSettings = {...} | null`. The `openCodeExecutionMode` check at line 1097 uses optional chaining. P04E must handle null settings.

3. **No existing tests** for systemPrompt — P04 tests will need to create conversation fixtures.

4. **PARAMETRIC_AGENT_PROMPT is a const, not a variable** — any attempt to modify it at runtime is impossible. Built-in protection is inherent.

---

## P04B Entry Point

P04B should start by:

1. Adding a `getBuiltInPromptFingerprint()` function that computes SHA-256 of `PARAMETRIC_AGENT_PROMPT`
2. Creating the built-in profile record in `prompt_profiles` table (insert if not exists)
3. Exposing the built-in prompt via API route: `GET /api/ai-settings/prompt-profiles/built-in`
