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

**Status: IN PROGRESS**

- remove billing-service preflight from AI chat
- remove `402 insufficient_tokens` and billing-service availability gating from normal generation
- remove post-generation token consumption/refund calls from AI chat and legacy fal mesh generation
- remove billing-derived message metadata/pricing helpers that exist only to charge pCAD credits
- ensure local/custom/hosted AI calls depend only on provider availability/configuration
- update stale persistence comments that assume `billing.consume` delays message insertion
- keep billing API/UI files temporarily so runtime decoupling can be validated independently

Validation gate:

- `BILLING_SERVICE_URL` and `BILLING_SERVICE_KEY` are not required for Parametric or Creative generation
- focused server tests pass
- full server suite passes
- typecheck passes

## Step 2 — Remove billing from auth/session state

**Status: PENDING**

- remove billing polling from `AuthProvider`
- remove billing/subscription/plan/trial state from `AuthContext`
- remove billing from auth loading behavior
- remove plan/trial PostHog properties or replace them with non-billing identity metadata where appropriate
- remove mesh-event billing query invalidation

## Step 3 — Remove billing UI and client services

**Status: PENDING**

- remove credits/token-pack UI and hooks
- remove subscription/trial/plan/limit UI
- remove subscription route and billing links
- remove billing product/checkout client services
- clean Settings and other surfaces that expose payment state
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
