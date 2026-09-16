# Native BRep Phase G2 runtime evidence harness — 2026-09-16

Status: **repository harness checkpoint; empirical G2 classification still pending**

Repository: `weaf/brepia`

Branch: `feature/brep-grasshopper-gh-packaging`

Selected phase: **Phase G — context-growth measurement**

## Purpose

This checkpoint makes the representative OpenCode Streaming G2 run reproducible without changing Brepia's normal AI execution path.

The harness captures only the four existing bounded diagnostic records required by the Phase G evidence gate:

```text
ai context diagnostics
ai step started
ai step diagnostics
ai context actual usage
```

It does not capture raw prompts, model messages, canonical project JSON, tool payload bodies, hidden reasoning or provider output.

This checkpoint is **not** empirical G2 evidence by itself. Phase G2 remains open until the harness is run against the real local OpenCode Streaming / llama-swap runtime and yields consecutive step/repair measurements.

## Capture boundary

`scripts/brep-g2-context-capture.cjs` is an opt-in Node preload.

It is inert unless:

```text
PCAD_G2_CONTEXT_EVIDENCE_JSONL=/path/to/evidence.jsonl
```

is configured.

When enabled it intercepts `console.info` only for the four exact diagnostic labels above, writes each already-bounded object as one JSONL record, and then preserves the original console output unchanged.

The preload is intentionally outside `src/server/aiChat.ts`. Therefore the harness does not alter:

- model routing;
- OpenCode session identity;
- tool routing;
- C5 hard-budget enforcement;
- repair limits;
- canonical BRep validation/runtime semantics;
- revision persistence;
- compaction/history behavior.

A capture write failure is evidence-harness failure only; it does not replace or weaken product runtime semantics.

## Runner

Use:

```bash
./scripts/run-brep-g2-context-stress.sh
```

or provide an explicit evidence path:

```bash
./scripts/run-brep-g2-context-stress.sh /tmp/brepia-g2-context.jsonl
```

The wrapper:

1. truncates/creates one evidence file;
2. enables the bounded preload through `NODE_OPTIONS`;
3. exports `PCAD_G2_CONTEXT_EVIDENCE_JSONL`;
4. delegates to the canonical repository `./start.sh` launcher.

The operator should then perform exactly one representative Native BRep generation using **OpenCode Streaming**. Reusing a long-lived OpenCode session is permitted and is useful evidence when the runtime reports `step.ended.tokens`.

## Recommended G2 fixture

Use a design-intent prompt rather than prescribing the canonical graph. A representative fixture is:

```text
Create a parametric wall-mounted electrical control cabinet around 800 mm wide,
1200 mm high and 300 mm deep, with approximately 2 mm sheet thickness. Include
an open-front/hollow enclosure, a separate front door with clearance, hinges,
a simple handle/lock representation, an internal mounting plate, three horizontal
DIN rails, a cable-entry opening and repeated ventilation openings. Keep the
important overall dimensions parametric and preserve coherent clearances and
feature placement when dimensions change.
```

For G2 this fixture is used only to measure agent/runtime context growth. Do not treat success or failure here as the Phase I modeling-capability verdict.

## Analysis

After the generation ends, stop the launcher if desired and run:

```bash
node scripts/analyze-brep-g2-context.mjs /tmp/brepia-g2-context.jsonl
```

Use `--json` for a machine-readable report:

```bash
node scripts/analyze-brep-g2-context.mjs /tmp/brepia-g2-context.jsonl --json
```

The analyzer segments captures on each `ai context diagnostics` record and analyzes the newest run. It reports:

- conservative `estimatedInputTokens`;
- `estimatedInputTokensExcludingProviderToolSchemas`;
- static provider tool-schema estimate;
- model-budget source and hard-budget state;
- consecutive model-message token growth;
- tool-result growth;
- BRep tool/canonical payload growth;
- image growth;
- residual model-message growth after measured tool/image classes;
- OpenCode/provider input-token growth when actually reported.

Brepia-side dominance is calculated from positive consecutive deltas only. Static tool schemas and system/transport instruction overhead are reported separately rather than mislabeled as growth.

## External OpenCode usage rule

OpenCode external-session usage is `reported` only when the existing Streaming adapter supplies real token counts originating from OpenCode `step.ended.tokens`.

When the runtime does not report those tokens, the analyzer emits:

```text
external session usage: unavailable
```

It never converts missing usage into a zero-cost claim.

## G2 acceptance gate

A representative evidence run should contain all four record types and at least two consecutive model steps/repairs. The evidence can then classify:

- Brepia-side dominant growth from deterministic deltas;
- external persistent-session growth when OpenCode usage is reported;
- external-session growth as unknown/unavailable when it is not reported.

Do not start Phase H compaction until this empirical run has been captured and reviewed.

## Preserved permanent boundaries

This harness does not change:

- canonical `BrepProject` authority;
- `schemaVersion: 1`;
- canonical modeling operations;
- exactly-one-solid semantics;
- graph/integrity fail-closed behavior;
- build123d/OCCT authority;
- Rhino/GHX interoperability boundaries;
- immutable revisions;
- user-selected model routing;
- Phase E repair semantics;
- C5 hard-budget semantics;
- compaction/history projection.

PR #36 remains open, draft, stacked on `feature/brep-grasshopper-smart-component`, and unmerged.
