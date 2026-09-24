# Brepia Phase B1.1 - Conversation State Integrity

Status: IMPLEMENTED / VERIFIED
Date: 2026-09-22
Branch: hardening/foundation-b1
Baseline: 8d17e8c6fb93e4a845173227d49f7aec225d2df1

## Scope

B1.1 is bounded to A-STATE-001 from the Phase A findings: generic conversation metadata writes must not be able to replay a stale current_message_leaf_id.

B1.2 test/CI race hardening, B1.3 generated database type freshness, runtime isolation, templates and new BRep capabilities are explicitly not started here.

## Implemented boundary

- Generic title, privacy and settings writes use a narrow patch contract.
- The generic patch contract cannot express current_message_leaf_id.
- Explicit leaf selection uses a separate lifecycle mutation.
- public.patch_conversation_metadata performs one SECURITY INVOKER row update.
- Settings are merged atomically into the current persisted JSON value.
- Optimistic cache updates and rollback touch only requested fields, preserving concurrent leaf advances.
- Existing title/privacy/model/Creative-agent/OpenCode-mode call sites were migrated away from full cached Conversation writes.
- Generic .update(conversation) and .update(nextConversation) writes are no longer present.

## Verification

- Focused conversation mutation test: PASS.
- Real local PostgreSQL stale-metadata/newer-leaf race using the exact RPC: PASS.
- Full npm run test: PASS.
- npm run typecheck: PASS.
- npm run lint: PASS.
- npm run build: PASS.
- git diff --check: PASS.

Accepted DB race evidence:

    conversation metadata race: PASS
    stale_leaf=ab1fa0a5-4292-4911-bf5f-b02da75c04fa
    authoritative_leaf=b4971f40-4ee0-45fc-adb6-38a055be3e9d

The race also verified that independent settings patches preserve unrelated settings keys.

## Verification infrastructure note

The local Supabase DB container had to be recovered from a stale stopping state. Because GitHub Actions cleanup can remove the rootless Podman host-port helper while the DB container remains healthy, the race gate can fall back to direct podman exec PostgreSQL access. This is verification infrastructure behavior, not part of the product change.

## Deferred

- B1.2 broader deterministic race/CI hardening.
- B1.3 generated Supabase type freshness.
- Other Phase B packages.
- Phase C templates.
- New geometry/modeling capabilities.

shared/database.ts remains generated and was not hand-edited. The new RPC therefore uses a narrow local TypeScript signature until the separately authorized generated-type refresh.
