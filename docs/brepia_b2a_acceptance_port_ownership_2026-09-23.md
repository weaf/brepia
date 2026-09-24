# B2A — Acceptance port ownership

Date: 2026-09-23

Status: **CLOSED**

## Change

The browser-smoke acceptance runtime now owns an explicit configurable port contract.

- default port: `4174`
- override: `BREPIA_ACCEPTANCE_PORT`
- invalid port values fail during Playwright configuration
- `reuseExistingServer` is `false`, so an unrelated process already listening on the requested port is not silently accepted
- the spawned Vite server continues to use `--strictPort`

This closes the browser-smoke portion of Phase A finding `A-RUN-002`.

## Verification

Dquark/Herdr job: `brepia-b2a-browser-smoke-20260923-01`

Result: **PASS — 3 passed**

TypeScript typecheck also passed during the implementation step.

## Boundary

B2A only normalizes browser-smoke port ownership. Other historical acceptance harnesses with their own explicit origins remain separate compatibility surfaces and are not silently rewritten here.

The larger stable-runtime artifact ownership problem from `A-RUN-001` remains B2B.
