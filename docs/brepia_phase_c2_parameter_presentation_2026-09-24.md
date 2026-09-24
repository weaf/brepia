# Phase C2 — Parameter presentation metadata

Date: 2026-09-24

Status: IMPLEMENTED; acceptance verification pending.

Branch: `feature/phase-c2-parameter-presentation`

## Objective

Provide product-oriented parameter presentation metadata without creating a second source of truth for geometry, parameter validity or revision state.

The canonical rule remains:

`BrepProject.parameters = parameter authority`

Template presentation metadata may describe how those parameters are shown, but it may not redefine their geometry semantics.

## Reconciled baseline

C1 established:

- immutable built-in template identity/versioning;
- complete canonical BRep source snapshots;
- repository-backed catalog abstraction;
- independent project creation;
- template provenance that does not require catalog dereference.

The canonical BRep parameter currently owns:

- `id`;
- canonical `label`;
- `type`;
- `unit`;
- `default`;
- `min`;
- `max`;
- `step`;
- canonical `description`.

M0 and existing source normalization already validate these fields. C2 must not weaken or shadow that validation.

## C2 presentation contract

A template may now provide per-parameter presentation metadata:

- display `label`;
- product help/`description`;
- display-only `unitLabel`;
- `visibility: visible | hidden`;
- `tier: basic | advanced`.

A template may also provide presentation groups with:

- stable group id;
- label;
- description;
- `tier: basic | advanced`;
- ordered references to canonical published parameter IDs.

The existing global `parameterOrder` remains supported.

## Resolution semantics

`resolveBuiltinProductTemplateParameterPresentation()` returns the effective UI-facing parameter list.

Ordering:

1. IDs explicitly listed in `parameterOrder`;
2. all remaining canonical parameters in canonical source order.

Presentation fallbacks:

- display label falls back to canonical parameter label;
- help text falls back to canonical parameter description;
- visibility defaults to `visible`;
- tier defaults to the containing group's tier, then `basic`;
- `unitLabel` is optional and display-only.

Every resolved parameter still receives these values exclusively from canonical BRep source:

- `unit`;
- `default`;
- `min`;
- `max`;
- `step`.

## Explicit authority boundary

C2 rejects these keys when authored in per-parameter presentation metadata:

- `default`;
- `min`;
- `max`;
- `step`;
- `unit`;
- `type`.

This is intentional.

The roadmap mentioned possible “recommended min/max/default”. Those are not implemented in C2 because a second set of range/default values would be easy for UI code to accidentally treat as validation or initialization authority.

If product evidence later requires recommendations, they should be introduced as explicitly advisory hints with names and tests that cannot be confused with canonical parameter constraints. They must never alter M0 validation or persisted source values.

## Group integrity

- groups may reference only published canonical parameter IDs;
- one parameter may belong to at most one presentation group;
- group IDs remain unique;
- `parameterOrder` remains duplicate-free;
- per-parameter metadata may reference only published canonical parameter IDs.

Malformed metadata fails closed during template normalization.

## Geometry and persistence boundaries

C2 does not change:

- `BrepProject.schemaVersion`;
- canonical BRep serialization;
- parameter value persistence;
- immutable revision semantics;
- template provenance;
- project creation semantics;
- native build123d/OCCT evaluation;
- STEP export authority;
- Rhino/GHX interoperability;
- auth or RLS;
- database schema.

No C2 metadata is copied into geometry nodes or used by the BRep evaluator.

## Product/UI boundary

C2 provides a normalized presentation view model suitable for later template/product UI.

C2 itself does not implement:

- template discovery UI;
- preview cards;
- create-from-template UI flow;
- real product templates;
- cable tray/conduit/cabinet product packs.

Those remain later Phase C/Phase D work.

## Acceptance requirements

C2 is complete when tests prove:

- labels/help/order/group/tier/visibility resolve deterministically;
- omitted presentation metadata preserves usable canonical fallbacks;
- canonical numeric constraints and unit remain unchanged;
- geometry-authority keys are rejected from presentation metadata;
- unknown parameter references fail closed;
- a parameter cannot be assigned to multiple groups;
- existing C1 template/project semantics remain green under the full test suite.
