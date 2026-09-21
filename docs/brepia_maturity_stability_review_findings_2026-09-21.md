# Brepia Phase A — Maturity & Stability Review Findings

Status: **IN PROGRESS — analysis only**

Date: 2026-09-21

Repository: `weaf/brepia`

Review branch: `review/maturity-stability-phase-a`

Accepted `master` baseline:

```text
8d17e8c6fb93e4a845173227d49f7aec225d2df1
Merge pull request #51 from weaf/plan/maturity-productization-roadmap
```

## Authority and scope

This document is the live findings register for **Phase A — Maturity & Stability Review** from
`docs/brepia_maturity_productization_roadmap_2026-09-21.md`.

Phase A is analysis-only. Documentation/evidence may be added, but product, runtime, schema,
dependency and canonical BRep behavior must not be changed until the review is closed and the
Phase B scope is explicitly selected.

Historical plans, checkpoints and old `Next` sections are evidence only. Current `master` plus
the 2026-09-21 maturity/productization roadmap are authoritative.

Deferred modeling capabilities remain deferred. This review must not activate shell/thickness,
broader finishing/topology, broader revolve, arbitrary/general sweep, reusable sketch/profile/path
graphs, arbitrary workplanes, nested collection algebra, spline/NURBS constraints, C4 image
projection or an AI-generated rolling summary.

## Review tracks

- A0 — repository, release and authority reconciliation
- A1 — dependencies and toolchain
- A2 — runtime lifecycle, build output ownership and ports
- A3 — CI, branch protection, test architecture and acceptance
- A4 — Supabase schema, migrations, RLS, auth, persistence and security
- A5 — AI orchestration, context, repair, semantic quality and durable generation
- A6 — frontend state, UX, accessibility, performance and bundle
- A7 — canonical BRep, build123d/OCCT, STEP, Rhino/GHX and cross-runtime parity
- A8 — dead code, compatibility debt, TODO/FIXME/HACK and documentation drift
- A9 — final findings normalization and Phase B recommendation

## Current baseline evidence

- Local worktree was reconciled and fast-forwarded to exact accepted `master` baseline
  `8d17e8c6...`.
- Current Quality Gate for that commit passed.
- Vitest: **242 test files / 1372 tests passed**.
- Typecheck passed.
- Lint passed with `--max-warnings 0`.
- Production build passed.
- Browser smoke: **3 passed**.
- `npm audit`: **0 vulnerabilities**.
- No real npm deprecation warnings were observed in the accepted CI install/build log.
- Phase 9 Rhino/Grasshopper product-loop acceptance is **ACCEPTED / CLOSED**.
- Brepia's local Supabase stack is currently running and healthy.
- The Brepia app itself was not running in its Herdr runtime pane during this review checkpoint.

## Findings

### A-RUN-001 — Stable runtime serves mutable worktree build output

**Area:** runtime lifecycle / build output ownership

**Finding:** The canonical stable launcher builds the application in the same worktree and the
stable runtime then serves the generated `.output` through the preview/runtime proxy. A later
`npm run build` in the same worktree can therefore replace files being served by a long-lived
runtime.

**Evidence:**

- `start.sh` performs a production build before starting the stable runtime.
- `scripts/stable-runtime-proxy.mjs` launches the preview process against the generated build.
- Historical product-gap acceptance explicitly recorded that unrelated builds replaced the
  long-running runtime's `.output`, requiring an isolated worktree/build output.

**Impact:** A verification or development build can silently mutate the artifact an existing
stable runtime is serving. This can cause reload failures, inconsistent JS/server assets and
false acceptance evidence.

**Risk:** High for concurrent development/verification on the workstation.

**Recommended action:** Phase B should make a stable runtime own an immutable or isolated build
artifact. Candidate designs include per-run build directories or dedicated worktrees, with an
atomic handoff into the long-lived runtime. The runtime must not serve a directory that unrelated
builds can overwrite.

**Priority:** P1

**Scope/size:** Medium

**Required verification:** start stable runtime; run a separate production build; verify the
running runtime continues serving the exact original artifact; verify deliberate runtime replace
starts the new artifact cleanly.

**Disposition:** **must fix before templates**

---

### A-RUN-002 — Browser/acceptance ports are heterogeneous and partly hard-coded

**Area:** local verification / port ownership

**Finding:** Current Playwright and acceptance surfaces do not use one consistent configurable
port contract.

**Evidence:**

- `playwright.smoke.config.ts` hard-codes port `4173`.
- Local smoke uses `reuseExistingServer: true`, which can accept an unrelated process already
  occupying that port.
- Other acceptance harnesses historically use defaults such as `3000` or `3002`, with mixed
  levels of environment-variable override.
- For the current Phase A review, local preview/browser verification is intentionally assigned
  **4174** instead of 4173.

**Impact:** Tests can collide with developer runtimes or, worse, verify the wrong already-running
application.

**Risk:** Medium-high for local multi-project/multi-agent verification.

**Recommended action:** Phase B should introduce one explicit acceptance-origin/port contract and
strict runtime ownership. The solution should be configurable/dynamic rather than replacing one
hard-coded port with another.

**Priority:** P1

**Scope/size:** Medium

**Required verification:** run two independent Brepia verification instances concurrently on
different ports and prove each test hits only its owned runtime; occupied-port scenarios must fail
closed instead of reusing an unrelated server.

**Disposition:** **must fix before templates**

---

### A-RUN-003 — Supabase local API/database ports remain globally fixed

**Area:** local runtime / Supabase isolation

**Finding:** Brepia's local Supabase stack uses the traditional fixed local ports, including API
`54321` and database `54322`. Application proxy logic also assumes the local API endpoint.

**Evidence:** Dquark `podman-status` showed the live Brepia stack:

- `supabase_kong_brepia` -> host `54321`
- `supabase_db_brepia` -> host `54322`
- `supabase_studio_brepia` -> host `54323`
- related Brepia services are healthy.

Another project, Noty-create, is simultaneously running an isolated Supabase stack on randomized
host ports.

**Impact:** Brepia has weaker local isolation than the newer multi-project pattern. Fixed ports
constrain concurrent stacks and couple app/test configuration to one workstation-wide address.

**Risk:** Medium.

**Recommended action:** Evaluate whether Brepia should adopt isolated/randomized local Supabase
ports with an explicit generated/discovered environment contract. Do not change this until the
interaction with repo-owned `start.sh`, auth callbacks and acceptance harnesses is mapped.

**Priority:** P1

**Scope/size:** Medium-large

**Required verification:** Brepia and at least one other Supabase project run concurrently;
browser auth, REST, storage, realtime and server-side service-role access all resolve the intended
Brepia instance.

**Disposition:** **must fix before templates**

---

### A-CI-001 — Grasshopper build is not a required merge gate

**Area:** GitHub Actions / branch protection

**Finding:** `master` currently requires the `quality` status, while the separate
`Grasshopper Build` workflow is not a required status.

**Evidence:** Branch protection inspection earlier in this review returned required status context
`quality` only. The Grasshopper workflow is path-filtered and executes its .NET/Windows packaging
checks separately.

**Impact:** A Grasshopper/Rhino-related change can theoretically be mergeable even if the plugin or
package build fails.

**Risk:** Medium-high because GHX/Rhino interoperability is an accepted product boundary.

**Recommended action:** Phase B should create a branch-protection-safe interop gate. Do not simply
mark the current path-filtered job required, because a required workflow that does not run on
unrelated changes can block merges. Prefer an always-present umbrella/gating status that reports
pass/skip correctly and depends on the Grasshopper jobs when relevant.

**Priority:** P1

**Scope/size:** Small-medium

**Required verification:** exercise both an unrelated frontend-only PR and a Grasshopper-scoped PR;
the former must receive a valid passing/skipped interop gate and the latter must be blocked by a
failing Windows/.NET build.

**Disposition:** **must fix before templates**

---

### A-DATA-001 — Generated Supabase types lag the actual schema

**Area:** Supabase schema/type discipline

**Finding:** `generation_run_events` exists in schema/migrations and is used by production code,
but it is absent from checked-in `shared/database.ts`.

**Evidence:**

- `generation_runs` is present in `shared/database.ts`.
- `generation_run_events` and its append RPC are absent.
- `src/services/generationRunService.ts` isolates a manual
  `supabase as unknown as GenerationRunEventClient` cast and explicitly states it is temporary
  until generated types are refreshed.

**Impact:** Compile-time schema safety is bypassed exactly on the durable generation telemetry
path. Future schema changes can drift without TypeScript detecting them.

**Risk:** Medium.

**Recommended action:** regenerate database types from the accepted local schema and remove the
temporary cast. If regeneration creates unrelated drift, reconcile schema/migration authority
before accepting it.

**Priority:** P1

**Scope/size:** Small

**Required verification:** local Supabase migration/reset; regenerated types; no manual
`unknown` cast; full typecheck/test/quality gate.

**Disposition:** **must fix before templates**

---

### A-SEC-001 — SSRF protection is not consistently applied to provider inference

**Area:** AI provider security

**Finding:** `testProvider()` validates a user-configured URL through the SSRF guard, but the
normal custom-provider inference path loads the saved `base_url` and constructs an
OpenAI-compatible provider without applying the same network boundary.

**Evidence:** `src/server/customProviders.ts` applies `isSafeUrl()` before the provider test
request, while `buildCustomChatModel()` passes `providerRow.base_url` directly to
`createOpenAICompatible()`.

**Impact:** In deployments where ordinary users can configure provider endpoints, an inference
request can potentially reach network locations that the test endpoint intentionally blocks.

**Risk:** Potentially high, deployment-dependent.

**Important product constraint:** Brepia legitimately supports a local OpenAI-compatible/llama-swap
endpoint. A blanket private-network/localhost ban would break an intended product/runtime path.

**Recommended action:** define a coherent trust model. Possible direction: distinguish
operator-configured trusted local providers from user-authored remote providers and apply the same
validated endpoint policy to every outbound request in the untrusted path.

**Priority:** P1 pending deployment/trust-model confirmation

**Scope/size:** Medium

**Required verification:** explicit tests for public remote endpoints, blocked metadata/private
targets, DNS-resolved private addresses and an approved trusted-local llama-swap path.

**Disposition:** **needs product evidence**

---

### A-SEC-002 — IPv6 private/link-local SSRF filtering is incomplete

**Area:** AI provider security

**Finding:** Documentation/comments state that IPv6 loopback, link-local and unique-local ranges
are blocked, but `isSafeIpAddress()` only special-cases `::1`; other non-IPv4 strings fall
through as safe.

**Evidence:** The function returns `true` when the string is not four dot-separated IPv4
components, after only checking exact `::1`. Existing tests cover `::1` but not `fe80::/10`
or `fc00::/7`.

**Impact:** The current SSRF protection can permit IPv6 destinations that its stated security
contract says should be rejected.

**Risk:** Medium-high when the SSRF guard is used as a security boundary.

**Recommended action:** use a robust IP parser/range classifier and add IPv4-mapped IPv6,
link-local, unique-local, unspecified and multicast coverage. Avoid hand-rolled parsing expansion
if a well-maintained dependency or Node primitive can provide correct classification.

**Priority:** P1

**Scope/size:** Small-medium

**Required verification:** focused SSRF tests for `::1`, `::`, `fe80::/10`, `fc00::/7`,
IPv4-mapped private addresses, public IPv6 and DNS resolution to each class.

**Disposition:** **must fix before templates**

---

### A-AI-001 — Browser reload durability is strong; process-restart execution durability is bounded

**Area:** durable generation / session resume

**Finding:** The current system durably persists generation state and can recover UI status after
browser reload/reopen. It does not provide a queued worker that continues an in-flight generation
after the Brepia server process dies.

**Evidence:**

- `generation_runs` stores durable lifecycle state.
- generation event telemetry is persisted.
- browser/session code recovers current generation state from durable rows.
- in-memory AbortControllers are intentionally process-local.
- documented robust closeout explicitly states that true server-process restart continuation would
  require a real queued worker/job executor.

**Impact:** Browser reload is not the problem. A server crash/restart during a long generation may
leave work that cannot continue automatically and requires terminal reconciliation/cancellation.

**Risk:** Medium and product-expectation dependent.

**Recommended action:** Do not build a worker merely because one is architecturally possible.
First define the desired durability SLA. At minimum, confirm stale nonterminal runs are detected
and reconciled after restart so the UI cannot poll forever.

**Priority:** P2 unless product SLA requires restart-survivable jobs

**Scope/size:** Small for stale reconciliation; large for a real durable worker

**Required verification:** browser reload during generation; server restart during a nonterminal
run; reopen conversation; verify deterministic recovered terminal/recoverable state.

**Disposition:** **needs product evidence**

---

### A-AI-002 — Current context-budget solution is evidence-backed; rolling summary remains deferred

**Area:** AI context management

**Finding:** C1-C3 and C5-C6 are implemented and runtime-accepted. Historical structured BRep state
and superseded build reasoning are deterministically projected away while durable DB/UI history
remains intact.

**Evidence:** `docs/brep_ai_context_budget_plan.md` records accepted runtime measurements,
including a reduction of effective provider message bytes from roughly 83 kB to 1 kB in the C6
fixture and healthy hard-budget headroom.

**Impact:** No current maturity evidence justifies adding an AI-generated rolling summary.

**Risk:** Low.

**Recommended action:** preserve the existing deterministic projection/budget design. Reconsider
C4 or rolling summarization only when new measured image/user-history pressure demonstrates a
specific bottleneck.

**Priority:** P3

**Scope/size:** None now

**Required verification:** retain current context regression fixtures when future AI runtime code
changes.

**Disposition:** **do not change**

---

### A-DEP-001 — Dependencies are behind latest versions, but there is no security-driven upgrade need

**Area:** dependencies / toolchain

**Finding:** `npm outdated` shows a mixture of patch/minor updates and substantial major-version
migrations. The accepted install/audit is clean.

**Evidence:**

- `npm audit`: 0 vulnerabilities.
- no real deprecation warnings observed in accepted CI install.
- major jumps include AI SDK 6 -> 7, Tailwind 3 -> 4, Zod 3 -> 4, Three 0.160 ->
  0.186, Vitest 4 -> 5 and others.

**Impact:** Blanket upgrades would add migration risk without solving a demonstrated problem.

**Risk:** Low if current versions remain supported; high if upgraded indiscriminately.

**Recommended action:** use a targeted maintenance batch for low-risk patch/minor updates only when
there is a concrete fix or maintenance reason. Handle major upgrades as separately scoped
migrations with compatibility tests.

**Priority:** P2

**Scope/size:** Variable

**Required verification:** dependency-specific focused tests plus full Quality Gate; Grasshopper
gate when shared/interop code is affected.

**Disposition:** **safe to fix later**

---

### A-PERF-001 — Production bundle contains several large client chunks without an explicit budget gate

**Area:** frontend performance / bundle

**Finding:** The production build is successful, but multiple client chunks are materially large.

**Evidence from accepted Quality Gate build:**

- Three chunk ~776 kB raw / ~203 kB gzip
- Streamdown Mermaid ~672 kB / ~166 kB gzip
- generic chunk ~662 kB / ~143 kB gzip
- Streamdown core ~487 kB / ~148 kB gzip
- main/index chunk ~469 kB / ~154 kB gzip
- Cytoscape ~435 kB / ~138 kB gzip
- React Three ~378 kB / ~113 kB gzip

The Vite chunk-size warning threshold is configured high enough that these do not warn.

**Impact:** Initial-route and feature-load cost can grow unnoticed as product templates add UI.

**Risk:** Medium, but real user impact has not yet been measured.

**Recommended action:** measure route-level loading first. Then add a bundle budget and lazy-load
heavy optional feature families where evidence supports it. Do not optimize by raw chunk size
alone.

**Priority:** P2

**Scope/size:** Medium

**Required verification:** route-level browser/network measurements before and after; verify no
regression to CAD/editor interaction.

**Disposition:** **needs product evidence**

---

### A-BREP-001 — Phase 9 Rhino/GHX product loop is accepted and should remain a protected invariant

**Area:** canonical BRep / Rhino / GHX

**Finding:** The complete accepted product loop has installed Rhino 8 / Grasshopper evidence:
Brepia canonical project -> GHX -> Rhino solve/edit/save/reopen -> Brepia strict parameter-only
import -> explicit revision activation -> continued AI edit -> fresh GHX -> Rhino solve.

**Impact:** This is a mature interoperability boundary and should not be reopened casually.

**Risk:** Regression risk if CI/protection does not adequately represent the interop build.

**Recommended action:** preserve strict parameter-only return semantics and use A-CI-001 to improve
merge-gate coverage rather than broadening the canonical model.

**Priority:** P1 for protection, not for feature work

**Scope/size:** Small-medium

**Required verification:** existing GHX compiler tests, Grasshopper build and bounded installed-host
acceptance when the interop surface changes materially.

**Disposition:** **do not change** canonical behavior

---

### A-HYG-001 — Source TODO/FIXME/HACK debt is limited and not a template blocker

**Area:** code hygiene

**Finding:** The source tree contains few meaningful TODO/HACK markers. The most material is the
older OpenSCAD parameter parser, which still uses regex and carries a TODO for an AST parser.

**Impact:** The current debt is localized and does not indicate broad unfinished BRep architecture.

**Risk:** Low for the immediate product-template roadmap.

**Recommended action:** keep a bounded backlog item for the OpenSCAD parser and other small hygiene
items; do not mix them into Phase B unless a failing fixture demonstrates current impact.

**Priority:** P2/P3

**Scope/size:** Small-medium

**Required verification:** parser regression corpus if/when changed.

**Disposition:** **safe to fix later**

## Positive maturity observations

The review should preserve positive evidence, not only defects:

- current Quality Gate is strict and green;
- `npm audit` is clean;
- lint permits zero warnings;
- Native BRep schema authority is explicit and fail-closed;
- build123d/OCCT remains native geometry authority;
- Rhino/GHX remains a compiler/interoperability boundary rather than source authority;
- immutable revision semantics are established;
- AI context handling is measured and bounded rather than relying on speculative summarization;
- product-gap evidence distinguishes canonical representation gaps from AI semantic-authoring
  failures;
- current deferred-capability inventory prevents feature creep during foundation hardening.

## Provisional Phase B grouping

This is not yet the final Phase B plan. Current findings naturally group into:

1. **runtime isolation**
   - A-RUN-001 immutable build artifact
   - A-RUN-002 configurable/owned test origins
   - A-RUN-003 Supabase local isolation
2. **verification integrity**
   - A-CI-001 interop required gate
   - database type-generation verification from A-DATA-001
3. **security boundary**
   - A-SEC-001 provider trust model
   - A-SEC-002 correct IPv6 SSRF classification
4. **measured maintenance**
   - targeted dependency maintenance only
   - route/bundle performance measurement before optimization

The final prioritization remains open until A5-A8 are complete.
