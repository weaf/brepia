# B1.3 — Dependency and warning hygiene

Date: 2026-09-22

Status: **CLOSED — no dependency changes required**

## Decision

B1.3 does not perform a blanket dependency update.

The current Brepia dependency state is healthy and there is no demonstrated security, compatibility or runtime defect that justifies broad package-upgrade risk before the remaining foundation work.

## Current evidence

Reconciliation job: `brepia-b13-dependency-reconcile-20260922-2230-01`

- Node: `v26.7.0`
- npm: `11.19.0`
- declared Node engine: `^20.19.0 || >=22.12.0`
- declared npm engine: `>=10`
- package-lock format: `lockfileVersion: 3`
- `npm audit`: **0 vulnerabilities**

Brepia workflows currently use `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-dotnet@v6`, and `actions/upload-artifact@v7`.

The Node 20 deprecation warning seen while operating through Dquark comes from the separate `weaf/local-ai-orchestrator` control-plane workflow using `actions/checkout@v4`; it is not a Brepia workflow warning.

## Outdated dependency assessment

`npm outdated` reports both patch/minor updates and substantial major-version migrations.

Current-range updates exist for packages including AI SDK providers, Supabase, TanStack packages, Playwright, Vite, ESLint and formatting tooling.

Major migrations include AI SDK, Three, Zod, Vitest, Tailwind-related packages, Sentry and other runtime/UI libraries.

No available update in the current evidence is required to fix a known Brepia defect or vulnerability.

## Policy

- Do not run a broad `npm update` merely to reduce the outdated count.
- Apply patch/minor upgrades in bounded batches when they solve a concrete maintenance issue or are required by another accepted change.
- Treat major upgrades as explicit migration work with focused compatibility tests.
- Re-run `npm audit`, focused tests and the full Quality Gate for accepted dependency batches.
- Keep Phase A finding `A-DEP-001` as maintenance backlog rather than a template blocker.

## Closeout

B1.3 is complete with **no package or lockfile mutation**.

The remaining foundation work should proceed without speculative dependency churn.
