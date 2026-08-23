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
- billing API/auth/UI files remain temporarily in place so runtime decoupling can be validated independently

Validation completed by user:

- focused server tests green
- full server suite green
- typecheck green

## Step 2 — Remove billing from auth/session state

**Status: IMPLEMENTED — AWAITING VALIDATION**

Implemented on `remove-billing`:

- removed billing polling and billing schemas/fallback state from `AuthProvider`
- removed billing from the actual `AuthContext` value/type
- auth loading now depends only on auth/session and profile loading, never billing
- removed billing query invalidation from mesh realtime events
- removed subscription/trial properties from PostHog identity and made identity wait only for profile data
- moved the still-needed billing poll into a temporary `LegacyBillingProvider` outside `AuthProvider`
- retained a temporary compatibility bridge in `useAuth()` so Step 3 can remove existing billing UI independently without breaking the branch between steps
- the compatibility bridge does not alter auth `isLoading`; it exposes legacy billing data only to the UI that will be deleted in Step 3

Validation gate:

- `npm run typecheck`
- focused auth/UI tests if present
- full server suite remains green
- signed-in app loads even when billing is slow/unavailable; auth/profile state itself must not wait on billing

The temporary `LegacyBillingProvider`, legacy billing context types, and the compatibility `billing` field exposed by `useAuth()` are Step 3 deletion targets, not final architecture.

## Step 3 — Remove billing UI and client services

**Status: PENDING**

- remove credits/token-pack UI and hooks
- remove subscription/trial/plan/limit UI
- remove subscription route and billing links
- remove billing product/checkout client services
- clean Settings and other surfaces that expose payment state
- remove `LegacyBillingProvider`, legacy billing context, and the temporary `useAuth()` billing compatibility bridge
- regenerate route tree through the normal project tooling; do not hand-maintain generated routing output

## Step 4 — Remove billing backend/configuration

**Status: PENDING**

- remove billing API routes
- remove `billingClient.ts`
- remove billing URL/config modules and plan marketing config that no longer has a consumer
- remove billing cancellation from user teardown while preserving auth-user and storage deletion semantics
- remove `BILLING_SERVICE_URL`, `BILLING_SERVICE_KEY`, and billing-only environment/config references
- remove billing-only tests

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
