# Grasshopper / GHX round-trip architecture

## Purpose

This document is the current architecture authority for Brepia's Grasshopper interoperability work.

The product goal is not to make Brepia a Grasshopper clone, and it is not to require a Brepia Grasshopper plug-in merely to use an exported model. The goal is to give Grasshopper the same role that OpenSCAD already has in Brepia: an AI-native professional CAD continuation format while Brepia remains able to create, preview, validate and revise the model before the external CAD tool is opened.

## Product loop

The target loop is:

```text
User intent
   |
   v
Brepia AI
   |
   v
canonical Brepia/BRep model
   |
   +----> native Brepia evaluation ----> 3D preview + validation
   |
   +----> deterministic GHX compiler ---> model.ghx
                                          |
                                          v
                                  Rhino / Grasshopper
                                          |
                                          v
                                     edited GHX
                                          |
                                          v
                             strict Brepia import gate
                                          |
                                 supported changes only
                                          |
                                          v
                                canonical Brepia model
                                          |
                                          v
                                      Brepia AI
```

The user must not need Rhino or Grasshopper merely to see the model that Brepia created. Grasshopper is a continuation and interoperability surface, not the first runtime that makes the Brepia-generated geometry visible.

A representative workflow is:

```text
"Create an electrical cabinet"
  -> Brepia creates and previews it
"Add a larger handle and a window in the door"
  -> Brepia updates and previews it
Export
  -> Brepia emits GHX
User opens GHX in Grasshopper and changes supported parameters
  -> GHX returns to Brepia
Brepia validates and recovers the supported changes
"Add a push button on the side"
  -> Brepia AI edits the canonical model again
  -> Brepia previews it
  -> a new GHX can be exported
```

## Authority and representations

For the initial Grasshopper workflow, the canonical Brepia model remains the authority for Brepia-owned geometry, parameters, semantics, validation and revisions.

GHX is a derived but editable Grasshopper-native representation of that model. It is not an independent second source of truth and arbitrary Grasshopper graphs are not silently converted into canonical `BrepProject` state.

This gives two representations of the same Brepia-owned model for different purposes:

```text
                    canonical Brepia/BRep model
                             /         \
                            /           \
                 Brepia evaluator      GHX compiler
                        |                    |
                        v                    v
                  Brepia preview       Grasshopper
```

The two branches are not independent models. The canonical Brepia model owns the Brepia side; GHX is the professional external continuation artifact.

## GHX is the primary Grasshopper document format

Brepia should target `.ghx` as its primary Grasshopper document interchange format.

Grasshopper `.gh` and `.ghx` represent the same Grasshopper archive structure; `.gh` is the binary flavor and `.ghx` is the XML/text flavor. GHX is therefore preferable for Brepia because it is inspectable, diffable, parseable and suitable for deterministic generation and AI-assisted diagnostics without making binary serialization the product boundary.

A user may later save the document as `.gh` in Grasshopper. Brepia does not need to make binary `.gh` generation the primary server-side workflow.

## Zero-install baseline; GHA is optional

The baseline product direction is **not** to require `Brepia.Grasshopper.gha`.

Prefer a zero-install Rhino 8 / Grasshopper workflow using standard Grasshopper objects and, where an executable bridge is required, a built-in Rhino 8 Script/C# Script component whose script is embedded in the GHX document.

A Brepia `.gha` may remain useful as:

- a reference implementation;
- a development probe;
- an optional richer integration later;
- a fallback if the built-in Script component cannot satisfy a concrete runtime, UX, security or compatibility requirement.

It must not become a hidden requirement unless a later evidence-backed architecture decision explicitly changes this document.

Existing Phase 7/8 GHA and Rhino-hosted packager code is therefore retained as useful implementation evidence and fallback work, but it is no longer the baseline product dependency.

## AI generation model

AI remains the primary authoring interface.

The preferred generation path is not an LLM freely emitting or patching large XML strings from memory. The safer architecture is:

```text
user intent
   -> AI model/graph intent
   -> structured Brepia Grasshopper representation/package plan
   -> deterministic GHX compiler
   -> deterministic validator
```

The internal component knowledge required to emit valid GHX is implementation infrastructure. It is not a user-visible Grasshopper component library that operators must maintain.

Brepia may bootstrap component identifiers, state encodings and examples from public references and real Rhino-generated fixtures, but Brepia should only claim support for component/state forms that are covered by its own validation fixtures and acceptance evidence.

GhJSON or similar formats may be useful as optional AI/debug adapters, but they are not canonical Brepia state and are not required by the product contract.

## GHX validation

AI must not be the only validator of generated or imported GHX.

The validator should be layered and produce machine-readable diagnostics that AI can consume:

1. **Transport/syntax validation**
   - bounded file size;
   - UTF-8/text constraints;
   - safe XML parsing;
   - reject malformed XML and unsafe XML features.

2. **GHX structural validation**
   - expected Grasshopper archive/document structure;
   - bounded object and connection counts;
   - required identifiers/state for the Brepia-supported GHX subset;
   - unique instance identities and valid connection references.

3. **Brepia semantic validation**
   - project identity and revision provenance;
   - stable published parameter IDs;
   - parameter values finite and inside canonical constraints;
   - expected Brepia-owned graph/script/template identity;
   - no unrecognized mutation of Brepia-owned wiring or executable state.

4. **Round-trip compatibility classification**
   - `supported`: Brepia-owned structure is recognized and only explicitly supported changes are present;
   - `unsupported`: the definition contains structural/code/graph changes that Brepia cannot safely reconcile in the current version.

5. **Optional Rhino/Grasshopper runtime acceptance**
   - when a supported Rhino-owned runtime is available, parse/open/solve/save-reopen the generated GHX as the strongest interoperability evidence.

The first round-trip version should be intentionally strict. Recover recognized parameter changes and Brepia-owned provenance. If an imported GHX contains unknown or unsupported semantic graph changes, do not manufacture a canonical Brepia revision from them. Explain that the model is no longer safely round-trippable in the current version.

A later phase may broaden support for selected native Grasshopper transformations or downstream graphs after explicit mapping and validation rules exist.

## AI interpretation and repair

AI is still valuable for both generated and imported GHX, but it operates around deterministic gates.

Recommended repair loop:

```text
GHX / structured graph
      |
      v
deterministic parser + validator
      |
      v
machine-readable diagnostics
      |
      v
AI explains / proposes repair
      |
      v
compiler or bounded edit
      |
      v
deterministic re-validation
```

An AI repair is never accepted merely because the AI says it is correct. It becomes valid only after the deterministic validator passes.

For unsupported imported GHX, AI may still explain what appears to have changed and help the user recreate the requested change in the canonical Brepia model. That interpretation is advisory until the supported-import gate proves that canonical state can be updated safely.

## GHXViewer and diagnostic tools

`seghier/GHXViewer` is useful as a development-time visual/parser diagnostic reference. It can parse and display GHX/XML structure and is useful for inspecting generated documents.

It must not be treated as Brepia's correctness validator without additional evidence. Its current implementation uses browser XML parsing and visualization; it does not provide the full Brepia semantic and round-trip checks above.

Brepia may use a viewer like GHXViewer for manual diagnostics or later build a small internal inspector, but the automated validator must remain independent and deterministic.

## Strict v1 round-trip boundary

The first production round-trip contract should prefer false negatives over unsafe reconstruction.

Supported initially:

- recognize the Brepia project and provenance embedded in the GHX;
- recognize the Brepia-owned generated structure;
- recover explicitly supported published parameter values;
- ignore or preserve non-semantic presentation/layout changes only when proven harmless;
- continue editing the recovered canonical model with Brepia AI;
- regenerate a fresh GHX from canonical state.

Unsupported initially:

- arbitrary new native Grasshopper components that affect model semantics;
- rewiring of Brepia-owned inputs through unknown graph logic;
- edited embedded Brepia runtime/script code that cannot be proven equivalent;
- arbitrary plugin components;
- generic GH graph -> canonical `BrepProject` reconstruction.

When unsupported content is detected, Brepia should state that it cannot guarantee or safely reuse that Grasshopper-modified model. The existing canonical Brepia revision remains intact.

## Acceptance principle

A Grasshopper feature belongs in this roadmap when it improves this loop:

```text
AI -> Brepia CAD -> preview/validate -> GHX -> human in Grasshopper -> supported GHX return -> Brepia AI
```

Work that primarily turns Brepia into a weaker Grasshopper/Rhino clone does not belong in the baseline architecture.
