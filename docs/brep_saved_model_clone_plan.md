# Deferred BRep saved-model clone / starting-point plan

Status: **deferred until the current BRep modeling and Rhino/Grasshopper acceptance track is complete**.

This plan records the follow-up product direction for the new **BRep Models** library. It must not interrupt or broaden the active M2/M3 modeling sequence, and it must not weaken the canonical BRep/revision authority model.

## Product goal

Let a user take a previously saved Native BRep model and use it as the starting point for a new creation, without mutating the source conversation or inheriting ambiguous revision history.

Intended UX:

```text
BRep Models
  -> select saved model
  -> Use as starting point / Duplicate
  -> new Parametric conversation
  -> independent Native BRep project lineage
  -> continue with parameters, structural editing and AI
```

The existing saved model remains unchanged and can still be opened normally.

## Identity contract to decide before implementation

Do not implement clone/duplicate until these identity rules are made explicit and covered by tests:

1. The clone gets a **new conversation identity**.
2. The clone gets a **new immutable revision lineage**.
3. Decide whether the canonical `BrepProject.id` is regenerated or preserved. The preferred default should be a new project identity for an independent creation unless a concrete interoperability requirement proves otherwise.
4. Decide whether canonical node IDs and parameter IDs are preserved inside the cloned project or deterministically regenerated.
5. If node/parameter IDs are regenerated, every internal reference, expression reference, result node reference, project-object role and semantic point reference must be rewritten atomically.
6. If node/parameter IDs are preserved, document why identical internal IDs across independent project identities are safe for persistence, GHX round-trip, export/import and AI editing.
7. The original conversation/revision IDs must never be reused.
8. The clone must not silently retain active-leaf/revision metadata that points back into the source conversation.

## Provenance

The clone should retain bounded provenance metadata sufficient for product UX and debugging, for example:

- source project/conversation identity;
- source revision identity;
- creation mode such as `cloned-from-saved-model`.

Provenance must be informational only. The cloned canonical project must remain independently editable and authoritative.

## Required behavior

A successful implementation should support:

- opening an existing saved model without cloning;
- explicitly choosing **Use as starting point** / **Duplicate**;
- creating a new independent conversation and first immutable BRep revision;
- preserving geometry, parameter defaults, bounded scalar expressions, feature graph, placements, project objects and metadata intended to travel with the model;
- immediately continuing with parameter edits, structural feature edits and AI follow-up;
- exporting/importing the cloned project without collisions or accidental linkage to the source lineage;
- GHX export/import continuing to respect the parameter-only round-trip boundary.

## Fail-closed requirements

The operation must fail before persistence if identity rewriting or canonical normalization cannot complete consistently. In particular, never create a partially cloned project with stale references into the source project or conversation.

## Acceptance

Before this feature is considered complete, verify at minimum:

1. Create/open a representative saved BRep model.
2. Clone it through the BRep Models UI.
3. Confirm new conversation and revision identities.
4. Confirm the source model is unchanged.
5. Confirm canonical geometry and parameter state initially match the source revision.
6. Change a parameter in the clone and verify only the clone changes.
7. Perform an AI structural edit in the clone and verify a new immutable clone revision.
8. Export STEP and canonical BRep package from the clone and validate independently.
9. Export GHX from the clone, solve in installed Rhino 8 / Grasshopper, change supported published parameters, import back, explicitly activate the imported revision, and confirm the source model remains untouched.
10. Reopen both source and clone after persistence and verify the two lineages remain independent.

## Scheduling boundary

This is intentionally a **post-current-roadmap product UX item**. Do not start it while M2 runtime/Rhino acceptance is open, and do not use it as a reason to bypass the existing M3+ modeling capability gates. Revisit it after the active BRep modeling/host-acceptance sequence is complete or at an explicit later product-UX checkpoint.
