# B1.3 — Dependency and warning hygiene

Date: 2026-09-22

Status: **CLOSED — no dependency changes required**

## Decision

B1.3 does not perform a blanket dependency update.

The current Brepia dependency state is healthy and there is no demonstrated security, compatibility or runtime defect that justifies taking broad package-upgrade risk before the remaining foundation work.

## Current evidence

Reconciliation job:

`brepia-b13-dependency-reconcile-20260922-2230-01`

Observed local toolchain:

- Node: `v26.7.0`
- npm: `11.19.0`
- declared Node engine: `^20.19.0 || >=22.12.0`
- declared npm engine: `>=10`
- package-lock format: `lockfileVersion: 3`

Security audit:

- `npm audit`: **0 vulnerabilities**
- low: 0
- moderate: 0
- high: 0
- critical: 0

Repository GitHub Actions currently reference:

- `actions/checkout@v7`
- `actions/setup-node@v7`
- `actions/setup-dotnet@v6`
- `actions/upload-artifact@v7`

The Node 20 deprecation warning observed while operating through Dquark is emitted by the separate `weaf/local-ai-orchestrator` control-plane workflow, which still invokes `actions/checkout@v4`. It is not a Brepia workflow warning and is therefore outside this repository's B1.3 scope.

## Outdated dependency assessment

`npm outdated` reports a mixture of patch/minor updates inside existing semver families and substantial major-version migrations.

Examples of current-range updates include AI SDK provider packages, Supabase, TanStack packages, Playwright, Vite, ESLint and formatting/tooling packages.

Examples of separately scoped major migrations include AI SDK, Three, Zod, Vitest, Tailwind-related packages, Sentry and other UI/runtime libraries.

No available update in the current evidence is required to resolve a known Brepia defect or vulnerability.

## Policy

- Do not run a broad `npm update` merely to reduce the outdated count.
- Apply patch/minor upgrades in bounded batches when they solve a concrete maintenance issue or are required by another accepted change.
- Treat major upgrades as explicit migration work with focused compatibility tests.
- Re-run `npm audit`, focused tests and the full Quality Gate for accepted dependency batches.
- Preserve the Phase A dependency finding `A-DEP-001` as a maintenance backlog rather than a template blocker.

## Closeout

B1.3 is considered complete with **no package or lockfile mutation**.

The remaining foundation work should proceed without coupling it to speculative dependency churn.
