# Native BRep Phase G2 runtime evidence harness — 2026-09-16

Status: **repository harness checkpoint; empirical multi-turn G2 classification still pending**

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

This checkpoint is **not** empirical G2 closeout by itself. Phase G2 remains open until the harness is run against the real local OpenCode Streaming / llama-swap runtime across consecutive turns in one persisted Native BRep conversation and the resulting growth is classified.

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

The operator should then use **OpenCode Streaming** and keep the same Native BRep conversation, model and transport for the whole G2 sequence. Reusing the long-lived OpenCode session is intentional because external-session growth is one of the classes being measured.

## Recommended G2 fixture

Start with a design-intent prompt rather than prescribing the canonical graph:

```text
Create a parametric wall-mounted electrical control cabinet around 800 mm wide,
1200 mm high and 300 mm deep, with approximately 2 mm sheet thickness. Include
an open-front/hollow enclosure, a separate front door with clearance, hinges,
a simple handle/lock representation, an internal mounting plate, three horizontal
DIN rails, a cable-entry opening and repeated ventilation openings. Keep the
important overall dimensions parametric and preserve coherent clearances and
feature placement when dimensions change.
```

Then remain in the same conversation and issue at least two ordinary follow-up edits, preferably:

```text
Change the cabinet width from 800 mm to 1000 mm while preserving the rest of the design intent.
```

```text
Change the cabinet height from 1200 mm to 1400 mm while preserving the rest of the design intent.
```

Optionally add a fourth turn:

```text
Change the sheet thickness from 2 mm to 3 mm and keep dependent clearances coherent.
```

For G2 this fixture is used only to measure agent/runtime context growth. Do not treat success or failure here as the Phase I modeling-capability verdict.

## Why turn-to-turn is the primary normal-path boundary

The first real OpenCode Streaming run against the harness produced a valid one-step trace:

```text
transport                         streaming-opencode
model                             agent/opencode/llama-swap/laguna-xs-128k
model budget source               local-settings
conservative Brepia estimate      25572 tokens
schema-free Brepia estimate       515 tokens
provider tool-schema estimate     25057 tokens
OpenCode first-step input         11896 tokens
hard budget enforced              true
AI SDK step count                 1
```

That one-step result is expected for a successful normal Native BRep turn:

- a first creation using Streaming OpenCode stops when `build_parametric_model` is returned;
- a persisted Native BRep follow-up stops after the first accepted BRep build;
- additional AI SDK steps occur only when bounded repair is actually required.

Therefore G2 must not manufacture invalid builds merely to obtain a second internal step. Normal-path context growth is measured across consecutive turns in the same persisted conversation. Internal step deltas remain an additional signal for real repair loops.

The large provider-tool-schema estimate is also deliberately kept separate from the OpenCode transport comparison because the Streaming OpenCode adapter does not forward the AI SDK provider tool schemas as provider tools. For OpenCode growth comparison, the schema-free Brepia estimate is the relevant request-side baseline.

## Analysis

After at least two turns, run:

```bash
node scripts/analyze-brep-g2-context.mjs /tmp/brepia-g2-context.jsonl
```

Use `--json` for a machine-readable report:

```bash
node scripts/analyze-brep-g2-context.mjs /tmp/brepia-g2-context.jsonl --json
```

The analyzer segments the file on every `ai context diagnostics` record and treats those runs as consecutive turns. It verifies that the model and transport remain stable before classifying turn growth.

The turn-level report includes:

- conservative and schema-free Brepia input estimates;
- system/instruction growth;
- authoritative current-BRep system-context growth;
- effective provider model-message growth;
- image growth;
- persisted historical BRep payload growth as a separate durability diagnostic;
- provider projection evidence showing historical BRep tool inputs/results removed from provider context;
- first-step OpenCode input tokens per turn when actually reported;
- OpenCode input-token deltas between turns;
- the residual between OpenCode input growth and the Brepia schema-free estimate, explicitly labeled as a diagnostic residual rather than an exact tokenizer-equivalent decomposition.

The first transition from creation to persisted follow-up normally introduces the authoritative current canonical BRep into system context. The analyzer records that as **one-time current-BRep activation** and excludes it from the dominant repeated-growth ranking. It is task-critical working state, not historical duplication and not a compaction target.

Internal AI SDK step analysis remains in the same report. If a real bounded repair produces multiple steps, the original per-step classification still reports:

- model-message growth;
- tool-result growth;
- BRep tool/canonical payload growth;
- image growth;
- residual model-message growth;
- reported OpenCode/provider usage.

## External OpenCode usage rule

OpenCode external-session usage is `reported` only when the existing Streaming adapter supplies real token counts originating from OpenCode `step.ended.tokens`.

When the runtime does not report those tokens, the analyzer emits:

```text
external session usage: unavailable
```

It never converts missing usage into a zero-cost claim.

## G2 acceptance gate

A representative normal-path evidence series should contain all four record types for each turn and at least two consecutive turns using the same model and transport in the same persisted Native BRep conversation.

Three or more turns are preferred because the first follow-up introduces the authoritative current-BRep system context; later deltas distinguish that expected one-time activation from repeated growth.

The evidence can then classify:

- repeated Brepia-side growth from deterministic turn deltas;
- whether historical BRep payloads are being pruned from provider context despite durable persistence;
- external persistent-session input growth when OpenCode usage is reported;
- external-session growth as unknown/unavailable when it is not reported;
- real repair-loop growth from internal step deltas when repairs naturally occur.

Do not start Phase H compaction until this empirical multi-turn series has been captured and reviewed.

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
