# B1.2 — Executable core RLS regression gate

Date: 2026-09-22

## Scope

B1.2 closes Phase A finding `A-SEC-004` for the core conversation data path by adding an executable Row Level Security regression gate.

The gate covers:

- `public.conversations`
- `public.messages`
- `public.images`
- `public.meshes`
- `public.previews`
- the B1.1 `public.patch_conversation_metadata(...)` SECURITY INVOKER RPC

The executable entry point is:

```sh
npm run test:rls
```

which runs `scripts/security/test-core-rls.sh`.

## Contract exercised

The test creates bounded local fixtures and executes SQL under explicit PostgreSQL roles and JWT claims.

It verifies that:

- the owner can read their private conversation data;
- another authenticated user cannot read the owner's private conversation data;
- anonymous access cannot read private conversation data;
- anonymous access can read the intentionally public conversation/message/image/mesh surfaces;
- previews remain owner-only even when their conversation is public;
- another authenticated user cannot update the owner's conversation;
- another authenticated user cannot delete the owner's message;
- anonymous access cannot update a public conversation;
- the owner can use `patch_conversation_metadata` on their own conversation;
- another authenticated user cannot use that RPC to mutate the owner's conversation.

The script uses the same local database connection fallback pattern as the B1.1 race gate: host PostgreSQL when reachable, otherwise the running rootless Podman Supabase database.

## Verification evidence

Herdr/Dquark job:

`brepia-b12a-rls-gate-20260922-01`

Result: **PASS**

All 24 assertions passed and the job ended with:

`core RLS regression: PASS`

## Boundary

This is a core RLS regression gate, not a claim that every auxiliary or administrative table in the repository has equivalent executable coverage. Broader security-surface expansion can be added incrementally when those surfaces are changed.

No production RLS policy was relaxed or broadened in B1.2.
