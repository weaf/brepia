# Billing-free Brepia architecture

## Purpose

Brepia does not contain an end-user billing system. Payment, subscriptions, credits, token balances, trials, checkout, token packs, and billing-service availability are not part of the application's runtime contract.

External AI/API provider costs are deployment concerns. They may affect how an operator configures providers, but they must not be represented as Brepia credits or used to gate generation.

## Runtime invariants

- Parametric and Creative generation do not perform a Brepia billing preflight.
- Generation does not call a billing consume/refund API.
- Generation cannot fail because a Brepia credit balance is exhausted or because a billing service is unavailable.
- HTTP 402 handling is not used for an internal Brepia billing workflow.
- Conversation/message persistence does not contain Brepia billing-credit metadata such as `billingTokens`.
- Authentication/session loading does not wait for billing or subscription state.
- Account deletion does not cancel a subscription and does not send cancellation-feedback data to a billing backend.

## User interface

The active UI contains no subscription, credits, trial, token-pack, checkout, payment-plan, invoice, or billing-limit workflow. Settings are limited to application/account/provider functionality rather than commercial-plan state.

The in-app Terms of Service must not describe paid subscriptions unless a billing product is intentionally reintroduced in a future, separately designed feature.

## Configuration

Brepia does not require billing-service environment variables. In particular, `BILLING_SERVICE_URL` and `BILLING_SERVICE_KEY` are not part of the supported environment contract.

AI provider credentials and endpoints remain supported because provider/API charging is independent of Brepia's removed end-user billing system.

## Persistence and migration history

Historical Supabase migrations that created, modified, scheduled, unscheduled, or later dropped billing/token-related schema are retained as migration history. They must not be deleted merely to remove terminology from the repository because a fresh database must still be able to replay the migration chain deterministically.

The presence of historical billing names in migrations is therefore not evidence of an active billing dependency.

## Maintenance rule

New code must not introduce user-facing generation limits through credits, plans, trials, token packs, or payment state unless billing is deliberately reintroduced as a separately reviewed product capability.

Usage telemetry may record provider/runtime consumption for diagnostics or operations, but telemetry must not silently become a user billing balance or generation gate.

## Removal validation

The billing-removal work on branch `remove-billing` was completed on 2026-08-23. The operator reported the final local typecheck, full test suite, production build, and residual billing-reference check as successful after the generated route tree had been regenerated and committed.
