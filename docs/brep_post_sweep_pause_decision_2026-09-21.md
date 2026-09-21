# Post-sweep project pause decision — 2026-09-21

Status: **DECIDED — pause after bounded sweep closeout**

Repository: `weaf/brepia`

## Decision

The bounded planar 90-degree circular sweep is the final implementation slice in the current Brepia development round.

After its Gate A/B/C/D acceptance, final repository verification and merge to `master`:

- do not start another modeling slice;
- do not select or implement another canonical BRep operation;
- do not broaden sweep;
- do not reopen previously deferred geometry capabilities merely because they remain deferred;
- do not create a follow-on feature branch as part of this closeout.

The project is intentionally paused.

## What this decision does not mean

The pause does not change or invalidate accepted architecture, tests, runtime evidence or existing deferred-scope documentation.

In particular, the following remain deferred rather than selected:

- general/open arbitrary sweep paths;
- multiple bends or arbitrary bend angles;
- non-planar rails;
- non-circular or holed sweep profiles;
- twist/frame/guide-rail authoring;
- reusable path/sketch graph values;
- shell/thickness;
- broader revolve variants;
- broader topology/finishing;
- arbitrary/reference planes;
- general collection algebra.

No ranking or prioritization among those deferred capabilities is made by this decision.

## Resume boundary

If Brepia development resumes later, begin with reconciliation against actual `master`, current runtime behavior and current product needs.

Do not infer a next task from historical `Next`, roadmap, backlog or deferred-scope text. A new implementation scope requires a fresh explicit decision at that future time.

## Closeout authority

The completed sweep acceptance is recorded in:

```text
docs/brep_sweep_status_2026-09-21.md
docs/brep_sweep_native_runtime_evidence_2026-09-19.md
docs/brep_sweep_rhino8_runtime_evidence_2026-09-21.md
docs/brep_sweep_product_path_evidence_2026-09-21.md
```

This pause decision supersedes the earlier sweep-plan wording that closeout should automatically return to a fresh product/scope decision. No new scope decision is selected now.
