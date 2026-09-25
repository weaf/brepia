# Brepia maturity, productization and product-driven geometry roadmap — 2026-09-21

Status: PLANNED — planning resumed after the post-sweep pause; no new product or geometry implementation is authorized by this document.

Repository: weaf/brepia

Planning branch: plan/maturity-productization-roadmap

Reconciled baseline:

    7b125730174f3537b4b55ce7ef6314f7ec7e4024
    Merge pull request #50 from weaf/feature/brep-planar-elbow-sweep
    Implement bounded BRep planar elbow sweep

Related authority/history:

- docs/brep_sweep_status_2026-09-21.md
- docs/brep_post_sweep_pause_decision_2026-09-21.md
- docs/brep_modeling_capability_expansion_plan.md
- docs/brep_product_gap_audit_status_2026-09-19.md
- docs/brep_ai_context_budget_plan.md
- docs/brep_phase9_rhino_acceptance.md

Detailed deferred/candidate inventory:

- docs/brepia_deferred_capability_inventory_2026-09-21.md

## Decision and strategic direction

The post-sweep pause is intentionally lifted only far enough to begin a new planning/review cycle.

The next development round should not begin by adding another BRep operation.

The selected sequence is:

    A. Maturity & Stability Review
       ->
    B. Foundation Hardening
       ->
    C. Product Template Foundation
       ->
    D. First Product Pack
       ->
    E. Product-driven BRep evolution

The purpose is to move Brepia from an increasingly capable CAD experiment toward a stable product platform while preserving the development discipline that has worked for the BRep engine:

    real product need
    -> reproduce/classify the gap
    -> smallest bounded capability
    -> native acceptance
    -> Rhino acceptance where applicable
    -> authenticated product-path acceptance
    -> closeout

No deferred CAD capability becomes active merely because it appears in an older roadmap.

## Core principles for the next development round

### 1. Stabilize before broadening

The accepted master should be treated as a candidate long-lived product baseline.

Before adding breadth, verify that the existing platform is understandable, reproducible, maintainable and operationally safe.

This does not mean freezing development for a long cleanup program. The review is bounded and must produce a prioritized findings list.

### 2. Do not perform blanket dependency modernization

Do not update packages simply because newer versions exist.

Every dependency/toolchain update should have a reason such as:

- security;
- unsupported/deprecated version;
- current bug;
- compatibility issue;
- meaningful performance or maintainability benefit;
- removal of a recurring warning;
- simplification of the build/runtime surface.

Large major-version changes require their own bounded verification.

### 3. Product Layer drives Geometry Platform

The next architecture should be understood as two cooperating layers.

Product Layer:

- templates;
- categories;
- product metadata;
- parameter presentation;
- previews;
- reusable product families;
- product-specific UX.

Geometry Platform:

- canonical BRep;
- scalar semantics;
- solid operations;
- build123d / OCCT;
- Rhino / GHX;
- STEP;
- graph integrity.

Rule:

The Product Layer may request new geometry capabilities when a real product cannot be represented faithfully. The Geometry Platform should not invent new capabilities speculatively.

### 4. Distinguish authoring failures from representation gaps

Past product-gap evidence already showed that a failed product generation does not automatically imply a missing BRep opcode.

Before extending the canonical language, classify a failure as one of:

1. runtime/platform defect;
2. AI authoring/semantic-correctness defect;
3. UX/product-layer limitation;
4. materially pathological but representable graph;
5. genuine canonical representation gap.

Only category 5, or a severe category-4 product blocker, should normally trigger a new geometry slice.

### 5. Preserve existing authority boundaries

Continue to preserve:

- canonical BRep project as model authority;
- immutable revision semantics;
- build123d / OCCT as authoritative native geometry runtime;
- Rhino/GHX as interoperability, not canonical authority;
- strict returned-GHX boundary;
- exact STEP as native CAD export authority;
- fail-closed unsupported geometry;
- M0 parameter effectiveness/integrity;
- bounded M1 scalar expressions;
- current single | instanceSet discipline;
- no persisted raw kernel topology IDs.

# Phase A — Maturity & Stability Review

Status: NEXT ACTIVE PHASE — ANALYSIS ONLY.

No feature implementation should occur during Phase A unless a separate explicit blocker-repair decision is made.

## A0 — baseline reconciliation

Reconcile current master against:

- AGENTS.md;
- README/setup/runtime documentation;
- package scripts;
- GitHub Actions;
- Supabase lifecycle;
- canonical BRep documentation;
- current Rhino/GHX boundary;
- current AI/context architecture;
- current Dquark-Control operating workflow.

Record:

- exact master SHA;
- Node/npm expectations;
- local service topology;
- canonical startup path;
- test/CI topology;
- current release/version identity.

Exit: one documented baseline with no reliance on historical branch state.

## A1 — dependency and toolchain health

Inspect:

- package.json;
- package-lock.json;
- npm outdated;
- npm audit;
- deprecated direct/transitive dependencies;
- install-script warnings;
- TypeScript version;
- ESLint/prettier/lint tooling;
- Vite/TanStack/Nitro versions;
- Playwright;
- Supabase CLI dependency;
- GitHub Actions versions;
- Node runtime assumptions;
- Python/build123d/OCCT/rhino3dm pins used by native BRep tooling.

Classify every proposed update as:

- required;
- recommended;
- optional;
- defer;
- do not change.

Do not mix unrelated major upgrades into one remediation.

Exit: a dependency/toolchain decision table with rationale and acceptance requirements.

## A2 — warnings, deprecations and build hygiene

Capture and classify:

- build warnings;
- lint warnings;
- TypeScript diagnostics;
- runtime warnings;
- Node/dependency deprecations;
- browser console warnings/errors;
- hydration warnings;
- React warnings;
- CI annotations;
- known package install warnings;
- stale compatibility warnings.

For every warning category decide:

- fix;
- document as intentional;
- upstream limitation;
- remove obsolete path;
- defer with evidence.

Goal is not cosmetic zero-warning output at any cost. Goal is that remaining warnings are understood and deliberate.

## A3 — CI and verification architecture

Review:

- Quality Gate coverage;
- browser-smoke coverage;
- acceptance tests;
- native BRep runtime smoke;
- Rhino installed-host evidence procedures;
- authenticated product-path acceptance;
- test flakiness;
- duplicated tests;
- expensive tests that belong outside ordinary CI;
- missing high-value regression paths;
- diff checks;
- dependency audit behavior;
- branch protection.

Explicitly examine known infrastructure edges:

- fixed test ports such as browser-smoke port 4173;
- isolation from unrelated long-lived runtimes;
- generated .output ownership;
- worktree isolation for long acceptance jobs;
- Herdr/Dquark finite job versus long-lived runtime discipline.

Exit: a verification matrix showing what each gate proves and what it does not prove.

## A4 — runtime and lifecycle stability

Review the repository-owned lifecycle:

- ./start.sh;
- stable runtime proxy;
- Vite/Nitro build output;
- OpenCode;
- Supabase;
- rootless Podman;
- local model endpoint.

Verify:

- idempotent startup;
- predictable shutdown/restart;
- stale process handling;
- port ownership;
- no build-over-running-.output corruption;
- service health checks;
- failure messages;
- stable-runtime recovery;
- Dquark-Control compatibility;
- long-lived runtime ownership.

The recent broken-loading incident caused by replacing .output underneath a running stable runtime must be treated as an operational regression target.

Exit: one canonical runtime lifecycle with documented ownership and recovery.

## A5 — application reliability

Review user-facing reliability for:

- sign-in/auth restore;
- route reload;
- browser refresh;
- session recovery;
- AI job persistence;
- leaving and returning to a running generation;
- request cancellation;
- transport timeout behavior;
- error boundaries;
- loading states;
- failed native evaluation;
- revision activation;
- download/export failures;
- offline/network interruption where relevant.

Pay particular attention to operations that may take minutes.

Exit: a list of critical user journeys with pass/fail evidence and prioritized gaps.

## A6 — Supabase, persistence and security

Review:

- schema source of truth;
- migrations;
- RLS policies;
- authentication boundaries;
- storage permissions;
- server-only secrets;
- client-exposed configuration;
- input validation;
- conversation/revision ownership;
- immutable revision semantics;
- imported artifacts;
- admin-only routes;
- local-development shortcuts that must not leak into product assumptions.

Do not alter schema merely to make the review cleaner.

Exit: security/persistence findings separated into correctness, hardening and optional improvements.

## A7 — AI orchestration and context health

Reconcile the completed context work:

- C1 observability;
- C2 compact provider schema;
- C2.5 Native BRep specialization;
- C3 BRep model-context projection;
- C5 hard model-aware context budget;
- C6 deterministic superseded-build reasoning projection.

C4 image-context projection remains evidence-deferred.

Review:

- selected model metadata;
- context budget enforcement;
- tool schema size;
- retry/repair loops;
- first-accepted-build stop behavior;
- durable generation status;
- resume after navigation/reload;
- authoring semantic correctness;
- hallucinated unsupported operations;
- user-facing failure explanations.

Do not add an AI-generated rolling summary unless new measurements demonstrate a need.

Exit: a current AI reliability/context assessment with measured blockers rather than speculative optimization.

## A8 — canonical BRep and CAD interoperability health

Review the accepted geometry platform as one integrated system:

- parameter effectiveness;
- scalar expressions;
- primitives;
- Booleans;
- mirror;
- linear/rectangular/circular patterns;
- profile extrusion;
- multi-loop extrusion;
- transforms;
- full revolve;
- semantic fillet boundary;
- bounded planar elbow sweep;
- project-object roles;
- STEP;
- 3DM/GHX;
- strict returned-GHX import.

Check for:

- inconsistencies between canonical/native/Rhino implementations;
- missing server-boundary validation;
- stale instructions;
- accidental breadth in provider schema;
- duplicated geometry semantics;
- edge cases that are silently best-effort rather than fail-closed.

Phase A must not convert deferred capabilities into active work.

## A9 — frontend, UX, accessibility and performance

Review:

- bundle/chunk warnings and largest chunks;
- lazy loading opportunities;
- loading-state clarity;
- keyboard/accessibility basics;
- form labeling;
- error presentation;
- mobile/desktop behavior where supported;
- BRep viewer responsiveness;
- revision-history usability;
- template/product navigation implications;
- duplicated state or obvious render churn.

Only measured or obvious product-impact issues should enter the hardening backlog.

## A10 — repository and documentation hygiene

Review:

- dead code;
- obsolete scripts;
- stale compatibility paths;
- old temporary acceptance utilities;
- generated files;
- old branches;
- misleading historical Next sections;
- documentation contradictions;
- duplicated source-of-truth documents;
- TODO/FIXME/HACK inventory.

Historical evidence should normally remain historical evidence rather than be rewritten away.

Current guidance must make it difficult for a future agent to restart a completed old phase accidentally.

## A11 — Phase A output

The review must end with one findings register.

Every item receives:

- ID;
- area;
- finding;
- evidence;
- impact;
- risk;
- recommended action;
- priority;
- estimated scope class;
- verification required.

Priority:

- P0 — correctness/security/data-loss;
- P1 — stability/reliability/maintainability blocker;
- P2 — worthwhile cleanup/developer experience/performance;
- P3 — optional polish.

Also classify each item as:

- must fix before templates;
- safe to fix later;
- do not change;
- needs product evidence.

Phase A does not proceed automatically. At closeout decide whether:

1. Phase B needs a small bounded hardening package;
2. Phase B needs several independently verified packages;
3. the baseline is already sufficiently stable to proceed quickly to Phase C.

# Phase B — Foundation Hardening

Status: PLANNED, CONTENTS DETERMINED BY PHASE A EVIDENCE.

Phase B is not a generic cleanup sprint.

Only findings accepted from Phase A enter this phase.

Possible bounded packages may include:

- dependency/security updates;
- warning/deprecation removal;
- runtime lifecycle repair;
- CI isolation;
- auth/session reliability;
- persisted AI-job recovery;
- Supabase/RLS fixes;
- stale compatibility removal;
- frontend reliability/performance;
- AI authoring correctness;
- documentation/source-of-truth repairs.

Hardening rules:

- one concern per bounded package where practical;
- preserve current product behavior unless change is intentional;
- no opportunistic BRep expansion;
- no broad framework migration hidden in cleanup;
- final exact checkpoint must pass repository CI;
- runtime-sensitive changes require real local runtime evidence;
- Rhino-sensitive changes require installed-host evidence only when the changed boundary actually touches Rhino behavior.

Exit target:

Establish a new stable baseline that can be described as the accepted product-platform foundation on which reusable product templates are built.

The closeout should explicitly record any known warnings/debt intentionally retained.

# Phase C — Product Template Foundation

Status: BUILT-IN FOUNDATION COMPLETE. C1–C5 COMPLETE; C6 DEFERRED; PHASE D NEXT.

## Objective

Introduce a first-class distinction between Template and Project / product instance.

A template is reusable product-definition authority.

A project is an independently revisioned product instance created from a template or from scratch.

## C1 — template identity and versioning

Status: COMPLETE. See `docs/brepia_phase_c1_template_identity_versioning_closeout_2026-09-24.md`.

Implemented a versioned template identity covering:

- id;
- version;
- name;
- category;
- description;
- canonical BRep source;
- published parameter presentation;
- preview metadata;
- provenance;
- compatibility metadata.

The exact persisted schema must be designed after Phase A, not assumed by this roadmap.

Questions to resolve:

- repository-built-in templates versus database templates;
- immutable template versions;
- template provenance on created projects;
- compatibility with canonical schemaVersion 1;
- template migration/update policy;
- whether old projects ever follow later template updates automatically.

Default preference:

Creating from a template produces an independent project/revision lineage. Later template changes do not silently mutate existing projects.

## C2 — parameter presentation metadata

Status: COMPLETE. See `docs/brepia_phase_c2_parameter_presentation_2026-09-24.md`.

Canonical geometry parameters and product UX are related but not identical.

Template-level presentation may need:

- display name;
- description/help;
- grouping;
- ordering;
- recommended min/max/default;
- unit display;
- visibility;
- advanced/basic grouping.

Do not duplicate geometry authority or introduce decorative controls that violate M0.

## C3 — template preview and discovery

Status: COMPLETE. See `docs/brepia_phase_c3_template_preview_discovery_2026-09-25.md`.

Built-in templates present:

- thumbnail/preview;
- category;
- short description;
- supported use;
- important parameters.

Keep the first UI deliberately small.

No marketplace or complex search system is required for the first slice.

## C4 — create-from-template flow

Status: COMPLETE. See `docs/brepia_phase_c4_create_from_template_flow_2026-09-25.md`.

Required product behavior:

    choose template
    -> create project
    -> assign independent project identity
    -> initialize canonical source
    -> create immutable initial revision
    -> open normal editor/viewer
    -> subsequent edits use ordinary project semantics

Template use must not create a second hidden geometry authority.

## C5 — template validation

Status: COMPLETE. See `docs/brepia_phase_c5_template_validation_2026-09-25.md`.

A built-in template should pass at least:

- canonical normalization;
- M0 integrity;
- native evaluation;
- expected result kind;
- effective published controls;
- export/import smoke where relevant;
- deterministic template version identity.

## C6 — user-created templates

Status: DEFERRED. Not required for the accepted built-in template foundation or Phase D product pack.

Not part of the first foundation unless Phase A/product needs strongly justify it.

The first implementation may begin with repository-owned built-in templates only.

User-created/shared templates can be a later product feature after the core lifecycle is proven.

# Phase D — First Product Pack

Status: NEXT. Phase C1–C5 built-in template foundation is complete; C6 remains deferred.

The first product pack should exercise different parts of the existing platform rather than choosing products that all test the same geometry.

## D1 — Electrical Cabinet

Role:

- reference complex product;
- existing proof that Brepia can build a useful parametrically editable assembly-like product;
- door open/close behavior provides a meaningful product interaction.

Initial template goal:

- preserve the already-working cabinet geometry;
- identify a bounded set of customer-facing dimensions;
- make door state/angle understandable;
- ensure M0-effective controls;
- native preview;
- STEP/export behavior appropriate to the product;
- template provenance and revision lifecycle.

Do not redesign the cabinet solely to make it more elegant during template foundation.

## D2 — Cable Tray

Purpose:

- fabricated linear product;
- dimensional relationships;
- repeated openings/perforation;
- possible lid/variants later;
- good test of product-level parameter organization.

Candidate v1 controls:

- Length;
- Width;
- Side Height;
- Material Thickness.

Optional v1/v1.1 controls, only if current geometry supports them cleanly:

- Hole/slot size;
- Hole/slot spacing;
- Perforation enabled.

Start with the simplest manufacturable canonical representation.

Do not activate shell/thickness just because a cable tray is thin-walled if explicit profile/extrusion/Boolean construction is reasonable.

Potential later variants:

- solid tray;
- perforated tray;
- lid;
- straight coupling;
- 90-degree bend;
- T-junction.

These variants are product candidates, not automatically one implementation phase.

## D3 — Cable Conduit / Pipe

Purpose:

- circular-section product;
- direct real use of the accepted sweep slice;
- dimension-driven product family.

Candidate first controls:

- Tube/outer diameter;
- Length(s);
- Bend Radius.

Potential v1 variants:

- straight conduit using existing cylinder semantics;
- one 90-degree elbow using the accepted bounded sweep;
- one simple straight-plus-elbow-plus-straight product.

Do not broaden sweep merely to create a more general routing system in the first product pack.

## D4 — Product acceptance contract

Each first-pack template should prove:

1. template can be discovered/created;
2. canonical project normalizes;
3. all published controls are effective;
4. native evaluation succeeds;
5. non-default parameter change recomputes authoritative geometry;
6. revision can be saved/reopened;
7. exact STEP is available where product semantics require it;
8. AI can edit the created product without losing template/project integrity;
9. product remains valid after ordinary reload/navigation.

Rhino/GHX acceptance is required only for changes that claim or modify the Rhino interoperability boundary.

# Phase E — Product-driven BRep evolution

Status: STANDING POLICY, NOT A PRESELECTED FEATURE LIST.

## Trigger

A real product or product variant cannot be represented faithfully or becomes materially pathological with the accepted language.

Before adding a geometry operation, document:

- exact product;
- exact requested geometry;
- current canonical attempt;
- whether failure is authoring or representation;
- graph size/pathology if representable;
- candidate minimal capability;
- why existing operations are insufficient.

Rank candidate capabilities by:

1. product importance;
2. number of blocked products/variants;
3. representational value;
4. schema complexity;
5. kernel sensitivity;
6. topology stability;
7. native/Rhino parity risk;
8. provider/context cost;
9. ability to define a small fail-closed first slice.

For any selected geometry slice use:

    scope decision
    -> locked implementation boundary
    -> repository implementation
    -> Gate A repository/CI
    -> Gate B native runtime
    -> Gate C installed Rhino when applicable
    -> Gate D authenticated product path when product-driven
    -> closeout

This is the process that successfully closed the Target-E sweep gap and remains the preferred geometry-development method.

# Explicitly not selected by this roadmap

This plan does not currently activate:

- M5 shell/thickness;
- M7 broad finishing/topology;
- arbitrary/general sweep;
- partial/arbitrary-axis revolve;
- reusable sketch/path/profile graph;
- arbitrary/reference workplanes;
- general collection algebra;
- topology IDs;
- spline/NURBS sketching;
- C4 image-context projection;
- AI-generated rolling conversation summary;
- marketplace/community template distribution;
- user-created/shared templates;
- a generic assembly solver;
- a general cable-routing system.

Those items are tracked separately as deferred or candidate work and require evidence/decision before implementation.

# Immediate next action after this planning document is accepted

Begin Phase A — Maturity & Stability Review from the reconciled current master.

Phase A starts with analysis and evidence collection only.

Do not begin Phase B hardening, Phase C template implementation or new BRep modeling work until the Phase A findings register is reviewed and accepted.
