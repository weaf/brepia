# C1.1 — Template contract and immutable registry closeout

Date: 2026-09-24

Status: COMPLETE

Branch: `design/c1-template-identity-versioning`

Accepted implementation checkpoint:

`2c40a35a7df119d0c92426a50d3ba6e5449cbcbc`

## Scope completed

C1.1 was intentionally split into four bounded slices:

- C1.1A — template contract and normalization;
- C1.1B — deterministic definition digest and immutability;
- C1.1C — repository built-in registry and exact `(id, version)` resolution;
- C1.1D — full repository closeout verification.

Implemented:

- separate `templateSchemaVersion: 1`;
- stable slug template `id`;
- positive integer template `version`;
- name/category/description normalization;
- compatibility metadata pinned to canonical BRep `schemaVersion: 1`;
- canonical template source normalized by the existing BRep authority;
- deterministic digest over normalized authoritative template content;
- fail-closed digest mismatch detection;
- deeply frozen accepted template definitions;
- immutable built-in registry;
- exact version resolution only;
- duplicate `(id, version)` rejection;
- deterministic registry listing;
- intentionally empty production template registry during C1.1.

Not implemented in C1.1:

- project instantiation;
- project/revision provenance;
- project-creation integration;
- package provenance;
- database-backed templates;
- UI/discovery;
- product templates;
- new BRep capabilities.

## Authority boundaries preserved

C1.1 does not modify canonical BRep geometry semantics.

- `BREP_PROJECT_SCHEMA_VERSION` remains `1`.
- `BrepProject` remains geometry authority.
- Template metadata does not create an alternate geometry graph.
- Native build123d/OCCT authority is unchanged.
- Rhino/GHX remains interoperability.
- STEP authority is unchanged.
- Existing immutable revision, auth and RLS boundaries are untouched.
- No database migration was introduced.

The registry intentionally exposes no implicit `latest` resolver. Consumers must request an exact template version, preventing silent upgrades.

## Verification evidence

### C1.1A

Dquark run `35979169617`:

- `test` — PASS
- `typecheck` — PASS

### C1.1B

Dquark run `35981880408`:

- `test` — PASS
- `typecheck` — PASS

### C1.1C

Dquark run `36004634143`:

- `test` — PASS
- `typecheck` — PASS

### C1.1D full quality gate

Dquark run `36005224428` — PASS.

The Brepia `quality` operation covers:

- `npm run lint`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- `git diff --check`.

## Next slice

Proceed to:

**C1.2 — Independent instantiation**

C1.2 must remain a pure project-creation boundary:

1. resolve one exact immutable template version;
2. deep-clone its normalized canonical source;
3. assign a fresh canonical `BrepProject.id`;
4. preserve node and parameter identities inside the independent clone;
5. prove no mutation can flow back into registry/template state.

C1.2 must not yet add persistence, conversation creation, provenance, UI, database schema, or product templates.
