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

### A-AI-003 — Product path can accept structurally valid but semantically wrong canonical geometry

**Area:** AI authoring / semantic quality

**Finding:** The canonical validator is intentionally structural and geometric, not a full natural-language
intent verifier. Real product-gap runs B and D show that an AI candidate can satisfy schema/integrity rules
while still mapping named dimensions or spatial intent incorrectly.

**Evidence:**

- Target B evaluated successfully as one valid native solid, but the generated revolve profile swapped the
  requested physical meaning of the locked U-axial/V-radial frame.
- Target D produced a structurally valid reachable graph but misplaced cabinet members, created disconnected
  union inputs and manually duplicated shelves instead of using the already-supported pattern surface.
- The current `tool-build-brep-project.md` already contains explicit U=axial/V=radial, centered-half-extent,
  Boolean-overlap and pattern sanity instructions.

**Impact:** Simply lengthening the prompt is unlikely to close the remaining semantic-quality gap reliably.
A model can acknowledge the correct rules yet still produce a valid-but-wrong product.

**Risk:** Medium-high for reusable product templates, because templates will make semantic correctness more
visible and repeatable.

**Recommended action:** Phase B should investigate bounded machine-verifiable semantic evidence rather than
new geometry opcodes or substantially longer prompts. Candidate directions include expected envelope/dimension
checks for product fixtures, deterministic spatial sanity helpers and product-specific acceptance assertions.
Do not make natural-language intent a new canonical geometry authority.

**Priority:** P1/P2 depending the first template acceptance design

**Scope/size:** Medium

**Required verification:** replay representative turned-part and cabinet fixtures and prove that the specific
wrong-frame/disconnected-placement failures are detected before being presented as successful product output.

**Disposition:** **must fix before templates** at the acceptance/quality layer; **do not change** canonical
geometry semantics solely for this finding.

---

### A-AI-004 — Restart-safe cancellation omits `waiting_for_preview`

**Area:** durable generation / restart recovery

**Finding:** The restart fallback used by Stop only looks for durable runs with status `queued` or
`running`. `waiting_for_preview` is also a valid nonterminal generation status and can transition to
`cancelled`, but it is excluded from `cancelLatestInFlightGenerationRun()`.

**Evidence:**

- `GENERATION_RUN_STATUSES` includes `waiting_for_preview`.
- the transition table explicitly permits `waiting_for_preview -> cancelled`.
- `AiGenerationRunLifecycle.persisted(..., true)` writes `status: waiting_for_preview` at
  `phase: revision_saved`.
- `cancelLatestInFlightGenerationRun()` queries only `.in('status', ['queued', 'running'])`.
- restart-safe cancellation delegates to that function when the in-memory AbortController no longer exists.

**Impact:** After a server restart in the revision-saved/native-preview handoff, the browser can retain a
nonterminal durable run that the restart fallback Stop path does not find.

**Risk:** Medium. The source revision is already durable at this point, so data integrity is not the concern;
truthful terminal lifecycle and recoverability are.

**Recommended action:** Include every cancellable nonterminal durable status in the restart-safe lookup, or
derive the lookup from the shared terminal-status contract so future nonterminal states cannot drift.

**Priority:** P1

**Scope/size:** Small

**Required verification:** focused persistence/cancellation test for a `waiting_for_preview` run after
in-memory state loss, plus browser/server-restart acceptance around the preview handoff.

**Disposition:** **must fix before templates**

---

### A-UX-001 — Some composer controls lack a robust keyboard/accessibility contract

**Area:** frontend accessibility

**Finding:** Several custom composer buttons bypass the otherwise good shared Radix/shadcn accessibility
patterns.

**Evidence:**

- the quad-topology button sets `focus-visible:ring-0` and `focus-visible:outline-none`;
- its visible text is omitted/hidden on compact layouts and the button has no explicit `aria-label`;
- the polygon-count custom button uses the same removed focus-ring pattern;
- Stop and Send are icon-only buttons whose accessible naming currently relies on surrounding tooltip
  behavior rather than an explicit button name;
- the repository otherwise contains strong use of labels, `aria-pressed`, focus-visible styles and
  reduced-motion handling.

**Impact:** Keyboard users can lose a visible focus cue, and compact/icon-only controls can be ambiguous to
assistive technology.

**Risk:** Medium, localized.

**Recommended action:** restore a visible focus treatment and give icon-only/compact controls explicit
accessible names. Add one lightweight automated accessibility smoke check for the primary composer surface;
do not introduce a broad accessibility rewrite.

**Priority:** P2

**Scope/size:** Small

**Required verification:** keyboard tab/focus pass at desktop and narrow viewport, accessible-name assertions
for the affected buttons, and a focused browser accessibility smoke if adopted.

**Disposition:** **must fix before templates**

---

### A-TEST-001 — Test count overstates executable behavior coverage

**Area:** test architecture / coverage observability

**Finding:** The repository has a large and valuable deterministic suite, but a material subset verifies source
shape or generated text by reading files directly. There is no configured Vitest coverage report/gate.

**Evidence:**

- accepted CI: 242 test files / 1372 passing tests;
- at least 67 test/harness files contain `fs.readFileSync`-based source/artifact inspection;
- examples cover UI source patterns, Python/native driver source, packaging scripts and generated Rhino/GHX
  artifacts;
- `vitest.config.ts` defines include/exclude patterns but no coverage provider or thresholds.

**Impact:** Raw passing-test count cannot be used as a proxy for exercised runtime behavior. Source-shape tests
are appropriate for some packaging/contracts, but critical user/runtime paths can still lack executable
coverage.

**Risk:** Medium as the product moves from capability expansion into reusable product templates.

**Recommended action:** Keep contract/source-shape tests where they protect generated artifacts, but identify a
small set of critical runtime boundaries and add executable tests there. First produce a coverage snapshot;
do not impose an arbitrary repository-wide percentage target.

**Priority:** P2

**Scope/size:** Medium

**Required verification:** coverage report used diagnostically; explicit executable coverage for selected
Phase B boundaries; no removal of useful packaging/contract tests without replacement.

**Disposition:** **safe to fix later** as a broad program, but Phase B fixes should add executable regression
tests for every touched critical boundary.

---

### A-TEST-002 — Some historical acceptance harnesses remain intentionally non-canonical or brittle

**Area:** acceptance architecture

**Finding:** The repository retains several valuable historical/manual acceptance harnesses with different
origins, ports and assumptions. Phase 9 documentation explicitly records that its automated `finalize`
stage is not accepted as fully green evidence because revision-history positional assumptions became
non-deterministic across retries.

**Evidence:**

- `playwright.config.ts` still uses fixed `http://localhost:3002/cadam`;
- GHX, Phase 9 and product-gap harnesses have separate configuration/origin conventions;
- Phase 9 closeout states installed-host acceptance is closed, but the automated finalize harness has retry
  robustness limitations around identifying the revision created by the current import attempt.

**Impact:** Historical harnesses are useful evidence, but they are not one coherent repeatable verification
layer and should not be mistaken for such.

**Risk:** Medium-low today; increases if new templates copy these patterns ad hoc.

**Recommended action:** In Phase B, define the modern acceptance harness contract together with A-RUN-002.
Leave historical fixtures as evidence unless a current product boundary depends on them. Where Phase 9 is
rerun, identify revisions by stable identity/correlation rather than newest/first position.

**Priority:** P2

**Scope/size:** Medium

**Required verification:** deterministic rerun after prior failed/retried state; configurable origin; explicit
artifact/run identity.

**Disposition:** **safe to fix later** except shared port/origin infrastructure in A-RUN-002.

---

### A-DATA-002 — Startup verifies Supabase health but not repository migration currency

**Area:** local runtime / database lifecycle

**Finding:** `start.sh` treats an already-running local Supabase stack as ready after
`npx supabase status`. It does not verify pending migrations or apply them before starting the app.

**Evidence:**

- running stack path is `supabase status -> "Supabase: up"`;
- `supabase migration up` or an equivalent pending-migration check is absent from `start.sh`;
- a one-time read-only local check during this review shows the current Dquark Brepia database is in fact
  fully aligned through migration `20260916071100`, so this is a lifecycle-design gap rather than current
  schema drift.

**Impact:** After a future fast-forward/update, a healthy long-lived local DB can remain older than the code
that starts against it.

**Risk:** Medium-high because failures can appear far from startup and look like product/runtime regressions.

**Recommended action:** Phase B should add a deterministic schema-currency preflight. Whether startup should
auto-apply migrations or fail closed with a clear operator command should be an explicit policy decision;
avoid destructive reset/push shortcuts.

**Priority:** P1

**Scope/size:** Small-medium

**Required verification:** start from a database one migration behind; launcher must either safely apply the
pending migration or refuse startup with an exact remediation; current database/data must remain intact.

**Disposition:** **must fix before templates**

---

### A-RUN-004 — Stable runtime depends on a documented Nitro 3 beta workaround

**Area:** runtime/toolchain maturity

**Finding:** The stable launcher intentionally serves the built TanStack/Nitro application through
`vite preview` instead of the direct Nitro node-server entrypoint because the checked-in Nitro 3 beta can
silently exit on Node versions without the expected `import.meta.main` behavior.

**Evidence:**

- `package.json` pins the Nitro 3 beta line;
- `scripts/stable-runtime-proxy.mjs` documents the direct node-server failure mode and explicitly chooses
  Vite preview as the workaround;
- accepted CI and local use show the workaround is functional.

**Impact:** The canonical stable runtime currently depends on a compatibility workaround around a beta server
runtime. This is maintainable today but is not an ideal long-term maturity baseline.

**Risk:** Medium.

**Recommended action:** Run a narrowly scoped runtime-toolchain evaluation in Phase B: determine whether a
newer compatible Nitro/TanStack combination removes the workaround without changing application semantics.
Do not combine this with blanket dependency upgrades.

**Priority:** P2

**Scope/size:** Medium if upgraded; small if the conclusion is to retain/document the workaround

**Required verification:** production build; direct server/preview start-stop; auth proxy; Supabase realtime;
long AI request; clean SIGINT/SIGTERM; no HMR/dev-client behavior in stable mode.

**Disposition:** **needs product evidence**

---

### A-SEC-003 — Public temp-multiview storage policy appears legacy and its cleanup contract is unclear

**Area:** storage security / compatibility debt

**Finding:** Supabase still grants public SELECT on the `temp-multiview` bucket for external Tripo download,
while current repository source contains no direct `temp-multiview` upload/read path. The schema says
service-role deletion is available for manual cleanup, while an old fal webhook comment says multiview images
auto-expire.

**Evidence:**

- `supabase/schemas/storage_policies.sql`: service-role insert/delete and public SELECT for
  `temp-multiview`;
- code search finds the bucket name only in schema/migration files;
- `src/server/falWebhook.ts` contains the historical comment "No manual cleanup needed - multiview images
  auto-expire".

**Impact:** If the bucket is still populated by an external/legacy path, temporary user imagery may remain
public longer than intended. If it is unused, the policy is unnecessary public attack surface and confusing
compatibility debt.

**Risk:** Unknown until live bucket/workflow evidence is checked.

**Recommended action:** Verify whether the live bucket exists, whether any current provider path still writes
to it, and what actual retention mechanism exists. Remove the policy/bucket only through an explicit migration
if proven obsolete.

**Priority:** P2

**Scope/size:** Small-medium

**Required verification:** live storage inventory and one current Creative/Tripo path if still supported;
confirm signed/public download requirements and cleanup/retention.

**Disposition:** **needs product evidence**

---

### A-BREP-002 — Native geometry execution sandbox is a mature security boundary

**Area:** canonical BRep / native execution security

**Finding:** Native BRep evaluation and OpenSCAD STEP conversion are both isolated outside the application
server with hardened rootless Podman runners.

**Evidence:** Both repository-owned runners use network isolation, read-only root filesystem,
`no-new-privileges`, `cap-drop=all`, bounded PIDs/memory/CPU, noexec tmpfs, read-only inputs/drivers,
bounded writable output and process timeout/cleanup.

**Impact:** User-controlled/AI-authored geometry does not execute arbitrary native geometry code in the
TanStack/Nitro host process.

**Risk:** Low under the current boundary.

**Recommended action:** Preserve this model. Future product templates or BRep features must use the existing
sandbox boundary rather than adding direct Python/build123d/OpenSCAD execution to the app server.

**Priority:** P3

**Scope/size:** None

**Required verification:** retain sandbox contract tests and real native smoke tests when runner/image flags
or native dependencies change.

**Disposition:** **do not change**

---

### A-HYG-002 — Files named “Legacy” are still active compatibility layers, not dead code

**Area:** dead-code review / compatibility

**Finding:** Several conspicuously named legacy modules remain in the active implementation path.

**Evidence:**

- `BrepFeatureEditor.tsx` wraps and invokes `BrepFeatureEditorLegacy.tsx`;
- `brepGrasshopperRhinoScript.ts` imports/exports and extends
  `brepGrasshopperRhinoScriptLegacy.ts`;
- `/cadam` is explicitly documented and browser-tested as a compatibility redirect.

**Impact:** Mechanical cleanup based on filenames would remove live behavior or compatibility guarantees.

**Risk:** High if treated as dead code; low if left intact.

**Recommended action:** Do not delete/rename these during generic cleanup. Any decomposition/rename requires a
separate behavior-preserving migration with consumers/tests identified first.

**Priority:** P3

**Scope/size:** None now

**Required verification:** existing UI, GHX/Rhino compiler and legacy-route tests if a future migration occurs.

**Disposition:** **do not change**

---

### A-STATE-001 — Generic conversation updates can overwrite a newer active leaf

**Area:** frontend state / persistence integrity

**Finding:** Generic conversation mutations send the complete cached `Conversation` row back to Supabase even
when the user is changing only one metadata/settings field. That full row includes
`current_message_leaf_id`, which is separately advanced by message inserts and protected by explicit CAS in
critical BRep/import paths.

**Evidence:**

- `EditorView`, `BrepProjectView` and `conversationService` use
  `.from('conversations').update(conversation)`;
- callers such as `useModelChange`, `ModelSelector` and `ChatTitle` construct the payload with
  `{ ...conversation, settings/title/privacy: ... }`;
- the messages AFTER INSERT trigger independently advances `current_message_leaf_id`;
- BRep AI and GHX/import persistence already use explicit locking/CAS because stale leaf writes are known to
  be unsafe;
- no equivalent CAS/column-scoped guard protects these generic metadata mutations.

**Impact:** A stale cached conversation used for a title/privacy/model-setting change can write an older
`current_message_leaf_id` after a newer message/revision has already advanced the active branch. This can
select the wrong branch after reload and undermine otherwise strong stale-generation protections.

**Risk:** High for concurrent generation, multiple tabs, background/mobile recovery and future template
workflows.

**Recommended action:** Replace full-row generic conversation writes with column-scoped patch mutations.
Treat `current_message_leaf_id` as a dedicated authority that is changed only by message/revision lifecycle
operations with the existing trigger/CAS semantics. Settings updates should also merge the intended key
without rewriting unrelated authoritative fields.

**Priority:** P1

**Scope/size:** Medium

**Required verification:** deterministic race tests where a newer message advances the leaf while title,
privacy and model/settings mutations use an older cached conversation; the metadata change must succeed while
the newer leaf remains unchanged. Include two-tab/browser evidence for one representative case.

**Disposition:** **must fix before templates**

---

### A-SEC-004 — Core RLS ownership rules lack executable regression tests

**Area:** Supabase RLS / authorization verification

**Finding:** Core ownership/public-read policies for conversations, messages, custom providers and durable
generation state are defined in schema/migrations, but the repository has no Supabase/pgTAP-style executable
policy test suite and no package script that exercises authenticated/anonymous/service-role policy boundaries
against the local database.

**Evidence:**

- policy definitions are present and reviewable in `supabase/schemas/*.sql`;
- searches for the concrete policy names find only schemas/migrations, not tests;
- `package.json` has no database/RLS test script;
- browser code directly accesses Supabase for conversation/message operations, making RLS a real security
  boundary rather than a defense-in-depth-only layer.

**Impact:** A future migration can accidentally broaden or break ownership access while TypeScript/unit/browser
tests remain green.

**Risk:** Medium-high because authorization regressions are high impact even when likelihood is low.

**Recommended action:** Add a small local-DB authorization matrix for the highest-value policies: owner vs
other authenticated user vs anon vs service role, including public/private conversation reads and
generation-run write denial. Keep it focused; a full database testing framework is not required.

**Priority:** P2

**Scope/size:** Small-medium

**Required verification:** local Supabase test identities/claims prove allow/deny behavior for the selected
tables and RPCs; include the gate in foundation verification when schema/RLS files change.

**Disposition:** **must fix before templates**

---

### A-DOC-001 — Root-level provider plan is stale enough to misdirect future work

**Area:** documentation authority / agent safety

**Finding:** `PLAN_llm_providers.md` remains highly visible in the repository root but describes a historical
pCAD/provider architecture and proposes work that no longer matches current Brepia implementation.

**Evidence:**

- the document is titled as a plan to implement auto-trader-ai's provider architecture in "pCAD";
- it describes missing LLM settings/custom-provider functionality that current Brepia already implements;
- it proposes a different provider/router/DB shape than the accepted current settings, custom-provider,
  OpenCode/Codex and model-routing architecture;
- the 2026-09-21 maturity roadmap explicitly states that older plans are evidence, not active work.

**Impact:** A new human or coding agent can reasonably discover this root-level file before the newer roadmap
and implement obsolete architecture or duplicate existing functionality.

**Risk:** Medium for maintainability and agent-driven development.

**Recommended action:** During Phase B documentation hardening, either move clearly obsolete plans into a
historical/archive location or add an unmistakable superseded banner that points at the current authority.
Preserve useful historical rationale; do not silently delete evidence.

**Priority:** P2

**Scope/size:** Small

**Required verification:** repository entry points (`README.md`, `AGENTS.md`, roadmap/index) identify one
current architecture authority; a search for active-looking root plans does not present superseded work as the
next implementation path.

**Disposition:** **must fix before templates**

---

### A-DOC-002 — One runtime setting description understates its Native BRep scope

**Area:** runtime configuration documentation

**Finding:** `transport.openCodeValidationAttempts` is used for both OpenSCAD and Native BRep external-agent
validation/repair, but its runtime description says it is the maximum automatic **OpenSCAD** repair attempts.

**Evidence:** `aiChat.ts` passes the same setting into OpenCode runtime configuration for either
`sourceKind: 'brep'` or `'openscad'`; OpenCode and CLI BRep repair paths consume the bounded validation
attempt count.

**Impact:** Operators can misinterpret a live runtime control while tuning Native BRep reliability.

**Risk:** Low.

**Recommended action:** Rename only the human-readable label/description to describe the shared
parametric/native validation boundary. Avoid changing the persisted key unless there is a separate migration
reason.

**Priority:** P3

**Scope/size:** Trivial

**Required verification:** config/catalog tests and settings UI text.

**Disposition:** **safe to fix later**

---

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
