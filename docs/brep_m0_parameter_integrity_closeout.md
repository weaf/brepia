# M0 BRep parameter effectiveness and graph integrity closeout

Status: repository-complete and CI-accepted on `feature/brep-grasshopper-gh-packaging`.

This closeout supersedes the M0 "next action" portions of `docs/brep_phase9_modeling_handover.md` and `docs/brep_modeling_capability_expansion_plan.md`. It does not close the separate Phase 9 installed Rhino 8 / Grasshopper round-trip acceptance sequence.

## Scope completed

M0 adds a shared deterministic canonical-project analysis and enforces it only for AI-authored BRep snapshots before they can become a new immutable revision.

The implementation intentionally does **not** change canonical BRep schema v1 validity, native build123d/OCCT evaluation, Grasshopper/GHX compilation, manual project editing, or imported legacy project acceptance.

## Shared analysis contract

`shared/brepProjectIntegrity.ts` analyzes a normalized canonical `BrepProject` without kernel/runtime heuristics.

Authoritative geometry roots are:

- `resultNodeId`;
- `projectObject.footprintNodeId` when present;
- `projectObject.clearanceEnvelopeNodeId` when present;
- `projectObject.maintenanceEnvelopeNodeId` when present.

Reachability follows canonical feature dependencies from those roots toward their prerequisites.

The analysis returns deterministic sorted sets for:

- result-reachable nodes;
- project-object-role-reachable nodes;
- the union of authoritative-reachable nodes;
- orphan nodes outside every authoritative geometry dependency closure.

Published parameters are classified exclusively as:

- `effective`: referenced by an authoritative-reachable feature node;
- `orphan-only`: not effective, but referenced by an orphan feature node;
- `semantic-only`: not feature-referenced, but intentionally referenced by project placement or project-object semantic point data;
- `unused`: referenced nowhere.

Classification precedence is `effective` -> `orphan-only` -> `semantic-only` -> `unused`. In particular, a parameter used by both orphan geometry and semantic data remains `orphan-only`; the semantic use does not hide the disconnected geometry dependency.

## AI persistence boundary

`shared/brepAiProject.ts` now applies M0 after canonical normalization on both:

- first native BRep AI creation;
- ordinary native BRep AI follow-up candidates.

An AI candidate is rejected with `BrepAiProjectError.code === 'graph_integrity'` when it contains:

- any orphan feature node;
- any `orphan-only` published parameter;
- any `unused` published parameter.

`semantic-only` published parameters remain valid because placement and semantic project-object point data are intentional supported outputs.

The existing server path already revalidates through these shared validators during build execution and final assistant finalization. Therefore a rejected M0 candidate is not captured as the accepted build input and cannot become a `data-brep-project` artifact through the fallback finalization path.

## Legacy/manual/import compatibility

M0 deliberately does not add these rules to `normalizeBrepProject()`.

Consequences:

- existing canonical v1 manual/imported projects with disconnected controls or orphan branches remain readable/valid under the schema;
- native evaluation and GHX interoperability continue to consume canonical snapshots exactly as before;
- when such a project is edited by AI, only the returned next snapshot must satisfy M0 before a new revision is persisted;
- an AI follow-up can therefore repair a legacy snapshot by removing ineffective parameters/orphan branches without making the previous revision invalid.

This keeps canonical/immutable revision authority intact while tightening only the AI authoring boundary requested by M0.

## Model-facing contract

`config/ai/instructions/tool-build-brep-project.md` now tells the model that:

- every feature node must contribute to the primary result or an explicit project-object geometry role;
- finishing features must not remain on disconnected branches;
- published parameters must affect authoritative geometry or intentional placement/semantic-point data;
- duplicate, placeholder and disconnected geometry controls must not be published.

This gives the model a repair target before the deterministic server gate rejects the candidate.

## Regression evidence

Dedicated tests cover:

- result/role reachability and orphan-node classification;
- all four parameter classes, including orphan-over-semantic precedence;
- the audited Room failure pattern: 10 published parameters with 5 authoritative-effective and 5 disconnected/unused;
- the audited Plate failure pattern: orphan fillet branch, `fillet_radius` as orphan-only, and three unused published controls;
- legacy canonical normalization remaining permissive while AI creation rejects the same ineffective candidate;
- semantic-only placement parameters remaining accepted;
- AI follow-up repair of a legacy ineffective parameter;
- build execution refusing to capture a rejected candidate;
- finalization revalidating fallback tool parts before persistence.

## Accepted checkpoint

Implementation checkpoint:

`3f2e00d62e6a93af7006fdf12af7c696afe8d8a9` — `Enforce M0 BRep graph integrity at AI boundary`

CI on that exact checkpoint:

- Quality Gate #719 — PASS
  - dependency audit PASS;
  - tests PASS;
  - typecheck PASS;
  - lint PASS;
  - build PASS;
  - diff check PASS;
- Grasshopper Build #291 — PASS
  - plugin build PASS;
  - Ubuntu package build PASS;
  - Windows package build PASS.

## Boundaries preserved

M0 preserves:

- `conversation.type = 'parametric'`;
- `parametricSourceKind = 'brep'`;
- canonical BRep project + immutable revision authority;
- build123d/OCCT as native geometry authority;
- Rhino/GHX as interoperability compiler only;
- strict parameter-only GHX return/import boundary;
- canonical schema v1 unchanged;
- unsupported operations fail closed;
- PR #36 remains draft and stacked on `feature/brep-grasshopper-smart-component`.

## Not started

M1 scalar-expression schema work has **not** started. No expression AST, union/intersection, pattern/mirror, profile/extrusion, non-zero rotation enablement, or new modeling node has been introduced by M0.

The separate remaining Phase 9 installed-host acceptance items also remain open, including authoritative fillet Result evidence, non-zero rotation evidence, Rhino-saved GHX return/import, explicit revision activation, continued Brepia AI editing, and fresh GHX re-open/solve acceptance.
