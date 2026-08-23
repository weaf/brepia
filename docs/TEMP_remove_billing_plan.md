# Temporary plan: remove billing from pCAD

> Temporary implementation/status plan for `remove-billing`. Remove this file when the phase is complete and permanent documentation reflects the resulting architecture.

## Goal

Remove pCAD's end-user payment, subscription, credits, trial, token-balance, checkout, and billing-service functionality while preserving authentication, AI provider configuration, CAD/Creative generation, conversation persistence, and account deletion.

Provider/API costs are deployment concerns, not an in-product pCAD billing system.

## Non-goals

- Do not remove Supabase authentication or user profiles.
- Do not remove AI providers merely because their APIs have external costs.
- Do not delete historical Supabase migrations solely because they once created billing tables; migration history must remain reproducible unless a separate schema squash is performed.
- Do not conflate AI usage diagnostics with user-facing credits. Any retained usage metric must be provider/runtime telemetry only and must not gate generation.

## Step 1 — Remove billing from generation runtime

**Status: COMPLETE — USER VALIDATED 2026-08-23**

Implemented on `remove-billing`:

- AI chat no longer calls the billing service before generation
- `402 insufficient_tokens` and billing-service availability gating were removed from AI chat
- AI chat no longer calculates pCAD billing credits from model token usage
- `billingTokens` was removed from persisted chat metadata and the shared message type
- AI chat no longer calls `billing.consume` after generation
- AI chat authentication no longer requires a user email solely for billing
- legacy fal mesh generation no longer consumes a fixed mesh credit charge
- legacy fal mesh generation no longer returns billing/credit failures before starting a mesh job
- stale persistence comments that depended on `billing.consume` timing were corrected

Validation completed by user:

- focused server tests green
- full server suite green
- typecheck green

## Step 2 — Remove billing from auth/session state

**Status: COMPLETE — USER VALIDATED 2026-08-23**

Implemented and validated on `remove-billing`:

- removed billing polling and billing schemas/fallback state from `AuthProvider`
- auth loading depends only on auth/session and profile loading, never billing
- removed billing query invalidation from mesh realtime events
- removed subscription/trial properties from PostHog identity
- separated the legacy billing poll from auth during the transition to Step 3

Validation completed by user:

- typecheck green
- full server suite green
- production build green
- signed-in/runtime smoke check green

The temporary legacy billing provider/context introduced to keep the branch buildable between Step 2 and Step 3 has now been removed as part of Step 3.

## Step 3 — Remove billing UI and client services

**Status: IMPLEMENTED — BUILD VALIDATED; GENERATED ROUTE TREE STILL NEEDS COMMIT**

Implemented on `remove-billing`:

- removed the home-page credits control
- removed credits, trial, low-credit, and limit-reached components
- removed trial dialog
- removed token-pack and billing-product hooks
- removed subscription purchase client service
- removed Billing section and payment copy from Settings
- removed Subscriptions link from the sidebar
- removed credit/token gating from PromptView and EditorView
- removed HTTP 402 billing-specific fetch/error handling from ChatSession
- removed billing query invalidation from completed chat turns
- removed `LegacyBillingProvider`, legacy billing context, and the temporary `useAuth()` billing compatibility bridge
- removed the `/subscription` source route
- repaired two unrelated test-harness failures discovered during validation: the creative mesh test now uses Vitest, and the model catalog test mocks unavailable OpenCode instead of invoking the real CLI

Validation completed by user:

- production build green on 2026-08-23
- prerender completed successfully for `/cadam`

Generated-file note:

- remote `src/routeTree.gen.ts` still reflects the old source routes
- regenerate it through TanStack/Vite tooling after Step 4 source-route deletions so `/subscription` and all removed billing API routes disappear in one generated update
- do not hand-edit `src/routeTree.gen.ts`

## Step 4 — Remove billing backend/configuration

**Status: IMPLEMENTED — AWAITING ROUTE REGEN + VALIDATION**

Implemented on `remove-billing`:

- removed `/api/billing-status`
- removed `/api/billing-products`
- removed `/api/billing-checkout`
- removed `src/server/billingClient.ts`
- removed `src/config/billing.ts`
- removed `src/config/plan-features.ts`
- removed billing cancellation and cancellation-feedback handling from account teardown
- preserved Supabase auth-user deletion semantics
- preserved storage deletion ordering and retry semantics for both user-facing deletion and internal purge
- removed `BILLING_SERVICE_URL` and `BILLING_SERVICE_KEY` from `.env.local.template`

Required generated-file step before validation:

- regenerate `src/routeTree.gen.ts` through TanStack/Vite tooling
- confirm `/subscription`, `/api/billing-status`, `/api/billing-products`, and `/api/billing-checkout` are absent

Validation gate:

- `npm run typecheck`
- full test suite
- `npm run build`
- account deletion regression check
- confirm app starts without billing environment variables

## Step 5 — Audit documentation and residual references

**Status: PENDING**

- search code/docs/tests for `billing`, `subscription`, `credits`, `token pack`, `trial`, Stripe identifiers, and billing-only env names
- distinguish historical migration content from active runtime dependencies
- update README/integration/docs where current behavior still describes payment functionality
- confirm no user-facing generation limit depends on credits/payment
- remove any dead billing-era helper code left behind by earlier decoupling steps

## Step 6 — Final regression and cleanup

**Status: PENDING**

- `npm run typecheck`
- focused tests for auth/chat/mesh/delete-user changes
- full server test suite
- production build
- runtime smoke test: Parametric generation without billing env
- runtime smoke test: local Creative generation without billing env
- verify clean working tree/root behavior
- replace this temporary plan with permanent architecture notes if needed, then remove it

## Completion criteria

- pCAD contains no active end-user payment/subscription/credit/trial workflow
- generation cannot fail because a pCAD billing service or credit balance is unavailable
- authentication and account deletion remain functional
- provider selection and API credentials remain functional
- historical DB migration chain remains reproducible
- tests/typecheck/build are green
