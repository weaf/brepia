# Phase C4 — Create-from-template flow

Date: 2026-09-25

Status: COMPLETE.

Branch: `feature/phase-c4-create-from-template-flow`

## Reconciled baseline

C4 started from verified master:

`787e26db102cc2bda75b34ae676861e56fae126d`

C1 established immutable template identity/versioning, canonical BRep snapshot materialization, SHA-256 source digests, project-level provenance and baseline-message provenance.

C3 established the discovery surface in `BrepModelLibrary`, with cards representing one exact discovered `(templateId, templateVersion)`.

The shipped built-in catalog remains intentionally empty. C4 is verified with injected test catalogs and does not introduce a Phase D product template.

## Implemented flow

The accepted product flow is now:

```text
choose discovered template
-> create project from exact discovered version
-> assign new project/conversation UUID
-> copy normalized canonical BRep source
-> persist immutable baseline messages/revision
-> persist template provenance
-> navigate to /brep/$id
-> continue with ordinary BRep project/revision semantics
```

The discovery card passes its already-discovered `templateId` and `templateVersion` directly to `createBrepProjectConversationFromTemplate()`.

There is no post-click `latest` resolution.

## Exact version and persistence boundary

`createBrepProjectConversationFromTemplate()` resolves through `catalog.requireExact({ id, version })` before any Supabase persistence.

A missing exact version therefore fails before conversation/message writes.

The accepted C4 persistence test uses a catalog containing both v1 and v2 of the same template family and requests v1 explicitly. It verifies that:

- the project title comes from v1;
- the persisted canonical source is v1 rather than v2;
- `settings.projectOrigin.templateVersion` is v1;
- assistant baseline metadata contains the same provenance;
- `sourceDigest` equals the digest of the canonical source actually persisted.

## Independent project identity and geometry authority

Each creation continues to use the existing C1 project-creation service, which creates:

- a fresh conversation/project UUID;
- fresh immutable baseline message IDs;
- a normalized, independent canonical BRep snapshot.

Template metadata is descriptive/audit metadata only.

Canonical BRep remains the geometry authority. C4 does not inject template presentation metadata into nodes, parameter values/defaults, constraints, evaluation or native geometry semantics.

After creation, no runtime dependency on the template catalog is required to open or edit the project.

## Duplicate-submit protection

The template creation action uses both:

- rendered loading/disabled state; and
- a synchronous in-flight ref guard.

The ref guard closes the gap before React can commit the disabled state, preventing rapid double-click/double-submit from issuing a second creation request.

Only one template creation may be in flight from the discovery surface at a time.

Creation errors are shown on the library surface and leave the user on the same page.

## Ordinary project lifecycle

Successful creation navigates to the existing ordinary project route:

`/brep/$id`

The project is then handled by the existing `BrepProjectView` and ordinary revision services.

C4 acceptance explicitly verifies that the normal project view does not import or consult product-template/catalog code and that later:

- parameter revisions;
- canonical source revisions;
- revision selection;
- reload/navigation;
- editor/viewer behavior

remain template-agnostic ordinary project semantics.

Scratch creation and package import continue through their existing paths.

There is no template-project mode.

## Acceptance coverage

C4 acceptance covers:

1. exact discovered `(templateId, version)` used for creation;
2. fresh project UUID;
3. independent normalized canonical source snapshot;
4. immutable baseline revision creation;
5. project-level provenance;
6. baseline-message provenance;
7. digest equality with persisted canonical source;
8. missing exact version failure before persistence;
9. duplicate-submit guard;
10. navigation to ordinary `/brep/$id`;
11. no catalog lookup required after creation;
12. scratch/import paths preserved.

The shipped catalog remains empty throughout these tests.

## Permanent boundaries preserved

C4 does not change:

- canonical BRep model authority;
- immutable revision semantics;
- build123d / OCCT native geometry authority;
- STEP exact native export;
- Rhino/GHX interoperability boundary;
- fail-closed unsupported geometry;
- M0 parameter integrity;
- scalar/expression semantics;
- auth/RLS;
- persisted topology-ID policy.

C4 introduces no new BRep capability, marketplace, user-created/shared templates, database-backed template CRUD, automatic template upgrades, product pack or assembly semantics.

## Verification evidence

Implementation-quality verification on final C4 source before documentation-only closeout updates:

- Dquark quality — PASS
  - run `36157234193`
  - lint — PASS
  - typecheck — PASS
  - full Vitest suite — PASS
  - build — PASS

Final closeout branch verification and protected PR gates are recorded in the PR/merge history.

## Closeout

Phase C4 is complete.

Roadmap status:

`C1–C4 COMPLETE; C5 NEXT`

Next:

**C5 — template validation**

C5 should validate built-in template definitions against canonical normalization, M0 integrity, native evaluation, result kind, effective controls, relevant export/import behavior and deterministic version identity without introducing a real Phase D product pack prematurely.
