# Brepia Phase A — Maturity & Stability Review

Date: 2026-09-21  
Status: **IN PROGRESS — analysis only**  
Repository: `weaf/brepia`  
Review branch: `review/phase-a-maturity-stability`  
Authoritative baseline: `master` at `8d17e8c6fb93e4a845173227d49f7aec225d2df1`

## Purpose

This review evaluates Brepia as a product platform before Product Template Foundation work begins.

No new BRep capability, product template, dependency migration, cleanup implementation, or product feature is authorized by this document. Findings remain analysis evidence until Phase A is complete and Phase B scope is explicitly selected.

Roadmap authority remains:

```text
Phase A Maturity Review
-> Phase B Foundation Hardening
-> Phase C Product Template Foundation
-> Phase D First Product Pack
-> Phase E Product-driven BRep evolution
```

Deferred capabilities remain deferred/candidate-only.

## Reconciliation baseline

Accepted facts so far:

- `master` is exactly `8d17e8c6fb93e4a845173227d49f7aec225d2df1`;
- local `/home/thn/ai/brepia` was clean but stale at `7b12573`, then Dquark `local-sync` fast-forwarded it to `8d17e8c`;
- Quality Gate on `8d17e8c` passed;
- `npm audit` reports 0 vulnerabilities;
- 1372 Vitest tests passed;
- typecheck, lint with `--max-warnings 0`, production build and browser smoke passed;
- Phase 9 Rhino / Grasshopper product-loop acceptance is CLOSED / ACCEPTED;
- sweep is integrated and the current maturity/productization roadmap governs next work;
- Brepia local Supabase is running and healthy;
- the Brepia application runtime itself was not running during runtime inventory.

## Review workstreams

1. **A0** baseline/release/runtime reconciliation
2. **A1** dependencies/toolchain
3. **A2** runtime/lifecycle/port ownership
4. **A3** CI/test/branch-protection architecture
5. **A4** Supabase/persistence/security
6. **A5** AI orchestration/context/session durability
7. **A6** frontend state/UX/accessibility/performance
8. **A7** canonical BRep/native/Rhino parity
9. **A8** dead code/compatibility/documentation drift
10. **A9** final prioritization and Phase B recommendation

A0-A5 and parts of A6-A8 have evidence below. Priorities remain provisional until Phase A closeout.

---

# Findings register

## PA-001 — Stable runtime build-output ownership

- **Area:** runtime / lifecycle
- **Concrete finding:** the stable launcher builds and serves from the same worktree `.output`; a later build in that worktree can replace files owned by a still-running stable runtime.
- **Evidence:** `start.sh` runs `npm run build` then `node scripts/stable-runtime-proxy.mjs`; the proxy launches `vite preview` against that build output. Product-gap acceptance previously observed a long-running runtime being damaged by another build.
- **Impact:** incoherent or disappearing long-lived runtime during product use/acceptance.
- **Risk:** P1
- **Recommended action:** immutable/staged runtime artifact or isolated build output/worktree for the lifetime of a running revision.
- **Priority:** P1
- **Scope/size:** medium
- **Verification:** prove a second build cannot alter an already-running stable revision; deliberate restart must pick up the new revision.
- **Classification:** **must fix before templates**

## PA-002 — Browser smoke fixed port and existing-server reuse

- **Area:** tests / local isolation
- **Concrete finding:** `playwright.smoke.config.ts` hard-codes `4173` and locally enables `reuseExistingServer`.
- **Evidence:** `playwright.smoke.config.ts` declares `const port = 4173`, uses `--strictPort`, and locally reuses an existing server. `vite.config.ts` also keeps preview port `4173` as the generic default, although the stable proxy can override its internal preview port.
- **Impact:** port collisions and possible accidental targeting of a stale/wrong local service.
- **Risk:** P1
- **Recommended action:** env-configurable or isolated allocated test port plus explicit target ownership. During this review use **4174** where the port is externally configurable; do not permanently solve this by merely hard-coding 4174.
- **Priority:** P1
- **Scope/size:** small
- **Verification:** local smoke must fail closed on wrong target and pass with isolated ownership; CI remains deterministic.
- **Classification:** **must fix before templates**

## PA-003 — Grasshopper build is not a required master check

- **Area:** GitHub Actions / branch protection
- **Concrete finding:** protected `master` requires only status context `quality`; Grasshopper Build is separate and not required.
- **Evidence:** GitHub branch metadata exposes only `quality` as required; `.github/workflows/grasshopper-build.yml` contains the Windows/.NET/plugin and packager build.
- **Impact:** a GH-scope change can theoretically merge despite failing the specialized build.
- **Risk:** P1
- **Recommended action:** add an always-present branch-protection-compatible GH/aggregate status rather than naively requiring a path-filtered job that can remain absent.
- **Priority:** P1
- **Scope/size:** small-medium
- **Verification:** induced GH failure blocks a GH PR; non-GH PR still gets a successful required status.
- **Classification:** **must fix before templates**

## PA-004 — Supabase generated database types are stale

- **Area:** Supabase / persistence / type safety
- **Concrete finding:** `generation_run_events` and its append RPC exist in schema/migrations and are used by the application, but are absent from `shared/database.ts`.
- **Evidence:** `supabase/schemas/generation_runs_events.sql` defines them; generated types contain `generation_runs` but not the event table/RPC; persistence code uses an `unknown` compatibility cast.
- **Impact:** schema drift is hidden from TypeScript and weakens the documented schema -> migration -> generated-types contract.
- **Risk:** P1
- **Recommended action:** regenerate types from the authoritative schema and remove the compatibility cast after parity is proven.
- **Priority:** P1
- **Scope/size:** small
- **Verification:** generated diff review, typecheck/tests, event append/read against local Supabase.
- **Classification:** **must fix before templates**

## PA-005 — Runtime custom-provider network boundary is weaker than provider-test boundary

- **Area:** security / provider routing
- **Concrete finding:** `testProvider()` applies `isSafeUrl()`, while normal custom OpenAI-compatible inference passes stored user-controlled `base_url` directly into the provider runtime without that policy.
- **Evidence:** direct comparison of `testProvider()` and `buildCustomChatModel()`.
- **Impact:** in an untrusted multi-user deployment, normal inference could reach network destinations that the explicit connectivity test rejects.
- **Risk:** P1 provisional; escalate to P0 if untrusted remote users can reach privileged server-side networks.
- **Recommended action:** define an explicit trust mode. Brepia legitimately supports localhost/private local LLM endpoints, so distinguish trusted local/operator endpoints from untrusted remote custom-provider endpoints and enforce one consistent policy.
- **Priority:** P1 provisional
- **Scope/size:** medium
- **Verification:** public, loopback, RFC1918, metadata/link-local, DNS-to-private and trusted-local test matrix; prove secrets are not leaked.
- **Classification:** **must fix before templates**

## PA-006 — SSRF IPv6 filtering is incomplete

- **Area:** security
- **Concrete finding:** documented intent says IPv6 private/link-local ranges are blocked, but `isSafeIpAddress()` treats every non-IPv4 address as safe except exact `::1`.
- **Evidence:** source and tests cover `::1`, but not `fe80::/10` or `fc00::/7`; non-four-octet addresses return true.
- **Impact:** SSRF guard is weaker than its own documented contract.
- **Risk:** P1
- **Recommended action:** robust IPv4/IPv6 parsing and explicit private/link-local/multicast/unspecified/reserved classification, aligned with PA-005 trust policy.
- **Priority:** P1
- **Scope/size:** small-medium
- **Verification:** focused IPv4/IPv6/DNS-resolution unit matrix.
- **Classification:** **must fix before templates**

## PA-007 — Local Supabase ports are globally fixed

- **Area:** runtime / local isolation
- **Concrete finding:** Brepia currently owns conventional fixed local Supabase ports such as API `54321` and DB `54322`; parts of the app/test setup also assume `54321`.
- **Evidence:** Dquark Podman inventory shows `supabase_kong_brepia` on `54321`, `supabase_db_brepia` on `54322`, while another local project simultaneously runs its own Supabase stack on different ports.
- **Impact:** reduced project isolation, parallel-environment collisions and cross-project targeting risk.
- **Risk:** P1
- **Recommended action:** repository-owned endpoint discovery/configuration with one resolved source consumed by launcher, proxy and tests.
- **Priority:** P1
- **Scope/size:** medium
- **Verification:** Brepia and another Supabase project run concurrently and every lifecycle/test path targets only its own stack.
- **Classification:** **must fix before templates**

## PA-008 — Dependency age is not currently a correctness/security blocker

- **Area:** dependencies / toolchain
- **Concrete finding:** many dependencies have newer versions, including major migrations, but current accepted master installs/builds cleanly with zero npm audit findings.
- **Evidence:** `npm outdated --json`; Quality Gate `npm audit` 0 vulnerabilities and no real package deprecation warning.
- **Impact:** blanket upgrades would create large regression surface without demonstrated benefit.
- **Risk:** P2
- **Recommended action:** no blanket upgrade. Separate compatible patch/minor maintenance from major migrations such as AI SDK 6->7, Tailwind 3->4, Three 0.160->0.186, Zod 3->4, Sentry 9->10.
- **Priority:** P2
- **Scope/size:** variable
- **Verification:** package-specific regression matrix for any selected upgrade.
- **Classification:** **safe to fix later**

## PA-009 — Client bundle contains several large chunks

- **Area:** frontend performance
- **Concrete finding:** accepted build includes large chunks such as Three ~776 kB raw, Mermaid ~672 kB, another chunk ~662 kB, Streamdown ~487 kB, app index ~469 kB, Cytoscape ~435 kB and React Three ~378 kB.
- **Evidence:** Quality Gate production-build output.
- **Impact:** potential route/startup cost, especially on weaker/mobile clients; current chunking already isolates many features.
- **Risk:** P2
- **Recommended action:** measure requested route chunks and interaction cost before changing bundling; lazy-load only where product evidence supports it.
- **Priority:** P2
- **Scope/size:** medium
- **Verification:** before/after bundle report and representative browser measurements.
- **Classification:** **needs product evidence**

## PA-010 — Full AI execution survival across server restart is not implemented

- **Area:** AI lifecycle / reliability
- **Concrete finding:** browser navigation/reload durability is implemented, but Brepia does not provide a durable queued executor that resumes an in-process model operation after server-process death.
- **Evidence:** accepted ROBUST-1 closeout explicitly separates durable `generation_runs` status from a true queued worker.
- **Impact:** whether execution itself must survive process restart is a product/deployment requirement, not something Phase A should assume.
- **Risk:** P2 unless deployment requirements make restart-surviving execution mandatory
- **Recommended action:** do not add a queue speculatively. Keep this separate from the concrete orphaned-run defect in PA-016.
- **Priority:** P2 provisional
- **Scope/size:** large if a real queue is required
- **Verification:** deployment/product requirement plus controlled server-restart acceptance.
- **Classification:** **needs product evidence**

## PA-011 — AI context budgeting is mature; rolling summary remains unjustified

- **Area:** AI orchestration / context
- **Concrete finding:** C1-C3 and C5-C6 are implemented/runtime-accepted; deterministic projection removes superseded BRep payload/reasoning while canonical source remains authoritative.
- **Evidence:** `docs/brep_ai_context_budget_plan.md` measured context ratios, hard-budget enforcement and headroom recovery.
- **Impact:** no current foundation defect in measured context path.
- **Risk:** P3
- **Recommended action:** preserve deterministic model; activate C4 or broader summaries only with new evidence.
- **Priority:** P3
- **Scope/size:** none now
- **Verification:** retain context-budget fixtures.
- **Classification:** **do not change**

## PA-012 — Geometry/runtime authority and Rhino/GHX parity are established

- **Area:** canonical BRep / interop
- **Concrete finding:** Phase 9 is CLOSED/ACCEPTED and sweep is integrated; canonical BRep, build123d/OCCT and Rhino/GHX roles are explicit.
- **Evidence:** Phase 9 closeout, sweep closeout and current roadmap.
- **Impact:** no review evidence supports activating deferred M5/M7/broader modeling capabilities before templates.
- **Risk:** P3
- **Recommended action:** preserve boundaries; future BRep evolution remains product-driven in Phase E.
- **Priority:** P3
- **Scope/size:** none
- **Verification:** preserve native + Rhino/GHX parity gates.
- **Classification:** **do not change**

## PA-013 — Product-gap failures must not be automatically reclassified as geometry gaps

- **Area:** AI semantic authoring / product evidence
- **Concrete finding:** targets B/D were semantic-authoring failures despite available canonical capability; C was representable; E was the concrete path/sweep gap and has since been closed through accepted sweep.
- **Evidence:** `docs/brep_product_gap_audit_status_2026-09-19.md`.
- **Impact:** adding geometry operations for semantic authoring failures increases canonical complexity without solving the failure class.
- **Risk:** P1 if misclassified
- **Recommended action:** retain explicit authoring/transport/context/validation/kernel/lifecycle/pathology/representation classification before any new opcode.
- **Priority:** P1 process invariant
- **Scope/size:** ongoing
- **Verification:** product-pack acceptance must inspect semantic correctness, not just canonical validity/evaluation.
- **Classification:** **do not change**

## PA-014 — Core TODO/FIXME/HACK inventory is low-risk

- **Area:** maintainability
- **Concrete finding:** no hidden high-priority TODO/FIXME/HACK debt was found in core Native BRep paths; remaining items are mainly older OpenSCAD parsing and a minor worker typing concern.
- **Evidence:** repository code search and source inspection.
- **Impact:** no reason for general cleanup to displace foundation hardening/templates.
- **Risk:** P2
- **Recommended action:** bounded cleanup only when relevant code is already touched.
- **Priority:** P2
- **Scope/size:** small
- **Verification:** focused affected tests.
- **Classification:** **safe to fix later**


## PA-015 — Real native CAD runtime is not part of the required merge gate

- **Area:** CI / native BRep verification
- **Concrete finding:** the repository contains real build123d/OCCT smoke harnesses that execute the sandbox, export exact STEP/3DM and independently re-import STEP, but normal Quality Gate does not execute them. Several Vitest tests instead assert that the harness/driver source contains expected logic.
- **Evidence:** Quality Gate runs `npm test`, typecheck, lint, build and browser smoke only. No workflow/package gate invokes `scripts/brep/smoke-test.sh`, `revolve-smoke.sh`, `sweep-smoke.sh` or `multiloop-extrude-smoke.sh`. During Phase A, Dquark `herdr-job-run` executed all four relevant native gates on current master: core smoke PASS, revolve PASS, sweep PASS, multi-loop PASS, all with `run_rc=0`; specialized exact-STEP checks reported build123d `0.11.1` and cadquery-ocp-novtk `7.9.3.1.1`.
- **Impact:** a change can pass required CI while breaking actual kernel/runtime translation or exact export behavior that static/source-level tests cannot prove.
- **Risk:** P1
- **Recommended action:** define one canonical finite native-runtime regression command and make its successful execution an explicit foundation/release gate. Decide whether it belongs in ordinary CI or in an auditable Dquark/self-hosted required gate based on runtime cost/image availability. Do not remove the fast structural tests; supplement them.
- **Priority:** P1
- **Scope/size:** medium
- **Verification:** intentionally break a native translation and prove the gate fails; restore and prove the aggregate native gate covers current core + revolve + multi-loop + sweep surfaces.
- **Classification:** **must fix before templates**

## PA-016 — Orphaned non-terminal generation runs can survive server death indefinitely

- **Area:** application reliability / durable AI lifecycle
- **Concrete finding:** `generation_runs` rows in `queued` or `running` status have no server-restart/orphan reconciliation. Client polling continues for every non-terminal run, while BRep source editing stays locked when the durable phase is an AI-editing phase.
- **Evidence:** `shouldPollGenerationRun()` returns true until terminal status; `isGenerationRunAiEditing()` treats request/model/generation/validation/save phases as edit-lock owners; persistence supports transition/cancel races but has no heartbeat, lease, process epoch or age-based orphan transition. The 10-minute session-storage attempt cursor does not terminalize the durable row.
- **Impact:** after Brepia server-process death during AI generation, reopening the project can poll forever and keep source/parameter editing disabled even though no worker exists that can finish the run.
- **Risk:** P1
- **Recommended action:** add explicit orphan/restart reconciliation without pretending jobs are resumable. A server-instance/lease or equivalent authoritative ownership model is preferable to an arbitrary short age timeout because legitimate local-model requests can take many minutes.
- **Priority:** P1
- **Scope/size:** medium
- **Verification:** kill/restart the server during queued/running BRep generation, reopen the project, prove the old run becomes a bounded terminal/recoverable state and editing is not permanently locked; verify normal long-running jobs are not falsely killed.
- **Classification:** **must fix before templates**

## PA-017 — No automated rendered accessibility gate

- **Area:** frontend / accessibility / UX verification
- **Concrete finding:** BRep UI contains many explicit labels/ARIA attributes and Radix primitives, but the repository has no `eslint-plugin-jsx-a11y`, axe integration or rendered DOM/component-test framework. Vitest runs in Node, and many UI tests assert source structure rather than rendered interaction.
- **Evidence:** no axe/jsx-a11y/testing-library dependency or test usage; `vitest.config.ts` uses `environment: 'node'`; BRep source contains explicit `aria-label`, labels and keyboard-focusable controls, so this finding is about missing regression evidence rather than a claim that the UI is inaccessible.
- **Impact:** focus order, keyboard-only behavior, dialog semantics, actual accessible names and mobile interaction regressions can pass current automated gates.
- **Risk:** P2
- **Recommended action:** add a small high-value rendered/browser accessibility layer when productization warrants it, starting with sign-in, model/template selection, BRep parameter editing and dialogs rather than attempting blanket retrofitting.
- **Priority:** P2
- **Scope/size:** medium
- **Verification:** keyboard traversal plus automated accessibility assertions on selected critical journeys.
- **Classification:** **safe to fix later**

## PA-018 — BRep frontend has concentrated maintenance hotspots

- **Area:** frontend maintainability / state ownership
- **Concrete finding:** several active BRep UI modules are large and state-dense. `BrepFeatureEditorLegacy.tsx` is still the active main feature editor through a wrapper despite its legacy name.
- **Evidence:** current master measurements: `BrepFeatureEditorLegacy.tsx` ~1,956 lines / 64 kB; `BrepProjectEditor.tsx` ~1,273 lines / 44 kB with 17 `useState` occurrences; `BrepProjectView.tsx` ~841 lines / 28 kB; `BrepChatSession.tsx` ~624 lines / 21 kB.
- **Impact:** broad edits in these modules have elevated regression/review cost; the legacy naming also obscures current ownership.
- **Risk:** P2
- **Recommended action:** do not refactor for aesthetics before templates. When an approved feature touches these areas, extract state machines/domain hooks or bounded editors along existing semantic boundaries. Rename legacy ownership only as part of a safe bounded extraction.
- **Priority:** P2
- **Scope/size:** medium-large if done broadly
- **Verification:** unchanged UI/product behavior plus focused source/interaction tests for extracted boundaries.
- **Classification:** **safe to fix later**

## PA-019 — Historical B9 acceptance harness is brittle and its closeout text overstates hardening

- **Area:** test hygiene / documentation drift
- **Concrete finding:** the manual Settings B9 Playwright harness remains timing-heavy and contains conditional visibility branches, while historical reconciliation text states that silent conditional passes were removed.
- **Evidence:** current `tests/b9_acceptance.test.ts` contains 37 `waitForTimeout` calls and 10 conditional `isVisible(...).catch(() => false)` branches. `vitest.config.ts` explicitly excludes this file; `package.json` exposes it only through manual `test:b9`.
- **Impact:** the harness can be slower/flakier and can overstate behavior coverage if treated as a canonical product gate; historical documentation can mislead future reviewers.
- **Risk:** P2
- **Recommended action:** label B9 clearly as historical/manual, or harden/replace only the scenarios still valuable. Do not count its historical 24/24 claim as current merge evidence.
- **Priority:** P2
- **Scope/size:** small-medium
- **Verification:** required assertions fail when target controls are absent; replace fixed sleeps with state/request/event waits for retained tests.
- **Classification:** **safe to fix later**

## PA-020 — Master build identity is materially ahead of the latest release tag

- **Area:** release / traceability
- **Concrete finding:** latest release is `v1.5.0` at `e648879`, while current master is 47 commits ahead at `8d17e8c`; `package.json` still reports version `1.5.0`.
- **Evidence:** GitHub compare `v1.5.0...master` reports `ahead_by: 47`; package version is `1.5.0`.
- **Impact:** an artifact built from master can identify with the same package version as the older tagged release despite materially different BRep capability and runtime behavior.
- **Risk:** P2
- **Recommended action:** keep release versioning deliberate, but expose build/revision identity for non-tagged stable runtimes and ensure the next release bumps/tags exact accepted foundation state. Do not bump package version merely to make Phase A look clean.
- **Priority:** P2
- **Scope/size:** small
- **Verification:** runtime/build metadata can identify exact Git SHA/release; release tag and declared version agree at release closeout.
- **Classification:** **safe to fix later**

## PA-021 — Obsolete-looking public temp-multiview storage policy needs ownership confirmation

- **Area:** Supabase storage / repository hygiene
- **Concrete finding:** declarative storage policy retains public read access for bucket `temp-multiview`, but current repository source has no code reference to that bucket; only schema/migration references remain.
- **Evidence:** repository search finds `temp-multiview` only in `supabase/schemas/storage_policies.sql` and one historical migration.
- **Impact:** if the bucket still exists and receives data through an external/manual path, its objects are intentionally public; if the path is dead, a public policy remains without an active product reason.
- **Risk:** P2 pending runtime/product ownership confirmation
- **Recommended action:** confirm whether the bucket exists and whether any supported mesh-provider flow still requires it. Remove only if proven obsolete; otherwise document retention/object-name/privacy contract.
- **Priority:** P2
- **Scope/size:** small
- **Verification:** storage bucket/policy inventory plus retained provider-flow test if still active.
- **Classification:** **needs product evidence**

## PA-022 — Provider-model RLS does not enforce parent-provider ownership on direct table writes

- **Area:** Supabase / data integrity / security hardening
- **Concrete finding:** `ai_provider_models` insert/update RLS checks only `auth.uid() = user_id`; the foreign key validates provider existence but not that `provider_id` belongs to the same user.
- **Evidence:** `ai_provider_models.sql` policies use only row `user_id`; application service methods correctly re-check provider/user ownership, but authenticated clients have table grants and RLS remains the database-side authority for direct access.
- **Impact:** an authenticated user who learns another provider UUID could create/update an own-user model row referencing that provider, violating ownership invariants and potentially causing unique-key interference.
- **Risk:** P1/P2 hardening; exploitability is limited by provider UUID confidentiality, but the invariant is structurally incomplete.
- **Recommended action:** enforce same-owner parent relationship in RLS/check/FK design, not only service code.
- **Priority:** P1
- **Scope/size:** small
- **Verification:** cross-user negative SQL/RLS tests for insert and provider_id update, plus normal CRUD tests.
- **Classification:** **must fix before templates**


---

# Positive findings / accepted foundations

- Quality Gate covers dependency audit, unit tests, typecheck, zero-warning lint, production build, browser smoke and diff check.
- Accepted `master` is green.
- Durable generation ownership and browser reload recovery exist.
- Context projection/hard budgeting are evidence-driven and measured.
- Canonical BRep and build123d/OCCT authority are explicit.
- Rhino/GHX strict return semantics are accepted through a real installed-host product loop.
- Product-gap methodology already distinguishes representation gaps from semantic-authoring failures.
- Deferred capabilities remain correctly deferred.
- Dependency age alone is not being treated as justification for churn.

# Review items still open

Before Phase A closeout:

- frontend state ownership / large-component review;
- accessibility coverage and keyboard/mobile behavior;
- route-level performance evidence;
- duplicated/flaky/obsolete acceptance harnesses;
- authenticated harness/port normalization;
- stale generation-run/server-restart behavior;
- custom-provider deployment/trust boundary confirmation;
- broader RLS/persistence ownership audit;
- compatibility/dead infrastructure review;
- documentation drift against current master;
- final P0/P1/P2/P3 normalization;
- final `must fix before templates` set and bounded Phase B package proposal.

## Current interpretation

Brepia does not currently appear to require an architectural restart or broad capability expansion.

The emerging Phase B shape is targeted foundation hardening around runtime artifact ownership, local/test isolation, verification architecture, schema/type parity and provider network/security boundaries, followed only by evidence-backed maintenance.

This remains provisional until Phase A is complete.


# Phase A verification matrix — current checkpoint

| Gate / evidence | What it proves | What it does not prove |
| --- | --- | --- |
| Quality Gate / `quality` | npm audit, Vitest, typecheck, zero-warning lint, production build, signed-out browser smoke, diff check | real build123d/OCCT execution, authenticated BRep product path, installed Rhino |
| Grasshopper Build | Windows .NET plugin compile plus Linux/Windows packager build | installed Rhino solve/runtime; currently not required by branch protection |
| Dquark core native smoke | actual sandboxed build123d/OCCT core geometry, STEP/3DM, Booleans, patterns, transforms and project-object roles | Rhino or authenticated browser |
| Dquark revolve smoke | real full-revolve native semantics and independent exact STEP import | installed Rhino/product path |
| Dquark multi-loop smoke | real multi-loop native extrusion and independent exact STEP import | installed Rhino/product path |
| Dquark sweep smoke | real bounded elbow sweep, X/Y/Z parity, parameter perturbation and independent exact STEP import | installed Rhino/product path |
| Phase 9 installed-host evidence | end-to-end Brepia -> GHX -> Rhino save/reopen -> Brepia import/activate -> AI continuation -> fresh Rhino solve | automatic per-commit regression |
| Product-gap / sweep Gate D evidence | authenticated real AI/BRep product-path behavior | deterministic fast merge gate |
| B9 Settings harness | historical/manual signed-in Settings scenarios | current reliable CI gate; harness still contains timing/conditional debt |

# Dependency/toolchain decision — current checkpoint

| Family | Decision | Rationale |
| --- | --- | --- |
| Node 22 CI / package engine compatibility | do not change | accepted gate is green; no runtime incompatibility found |
| TypeScript 5.8.3 | do not change | pinned and green; major TS 7 migration has no current justification |
| Vite 8.x / ESLint 10.x / Prettier 3.x current majors | optional patch/minor only | no warnings/blockers; upgrade only in bounded maintenance |
| Playwright 1.62 -> 1.63 | optional | no defect requires it; test-architecture fixes matter more than version churn |
| Supabase JS/CLI 2.x patch/minor | optional | no audit/runtime blocker; schema/type parity is the actual finding |
| AI SDK 6 -> 7 and provider major jumps | defer | high orchestration regression surface with no demonstrated need |
| Tailwind 3 -> 4 | defer | broad UI migration unrelated to Phase B findings |
| Three 0.160 -> 0.186 / React Three changes | defer | viewer risk and no concrete bug requiring migration |
| Zod 3 -> 4, Sentry 9 -> 10, other major jumps | defer | no security/correctness evidence requiring change |
| build123d 0.11.1 / cadquery-ocp-novtk 7.9.3.1.1 | do not change in generic maintenance | current canonical/native evidence is pinned and green; CAD runtime upgrades require dedicated parity acceptance |
