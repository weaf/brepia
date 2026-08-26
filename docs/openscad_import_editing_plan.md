# OpenSCAD Import & Existing Model Editing — implementation plan

Status: approved architecture / implementation not started
Base master: `192038ee5cb22222bd9861fcb2c6bab9dacdb9bb`
Feature branch: `feature/openscad-import-editing`
Last updated: 2026-08-25

## Goal

Allow a user to bring an existing OpenSCAD model into pCAD and continue working on it as a normal parametric pCAD project.

V1 must support:

- upload one `.scad` file;
- import one supported GitHub/Gist `.scad` URL;
- render the imported source in the existing OpenSCAD preview;
- create/open a normal parametric conversation;
- continue editing with AI through the existing `build_parametric_model` flow;
- preserve artifact/version semantics, branching/retry, parameter handling, preview, exports and conversation history;
- continue supporting bundled BOSL, BOSL2 and MCAD.

## Architecture decisions

### 1. Supabase message tree remains authoritative

Imported SCAD is not stored as ordinary chat text and does not introduce a separate canonical model table in V1.

The imported source becomes a real initial `ParametricArtifact` inside the normal persisted message tree. Existing conversation-workspace files remain best-effort mirrors of authoritative Supabase/message state.

### 2. Imported model representation

Create two initial messages for a new imported project:

1. a user import event, e.g. `Imported OpenSCAD model: bracket.scad`;
2. a synthetic assistant `tool-build_parametric_model` part containing the complete imported artifact.

Successful import shape:

```text
user import event
  -> assistant tool-build_parametric_model
       state: output-available
       input:
         title: <derived/import title>
         version: v1
         code: <complete imported SCAD>
       output:
         status: success
         message: Imported OpenSCAD model.
```

The tool call must have a stable synthetic ID such as `tool_import_<uuid>`.

If source validation/compilation fails but the source is still accepted for repair, persist the artifact input with `state: output-error` and a bounded compiler error. Never leave the initial imported tool part as `input-available`.

### 3. Import provenance

Store import provenance in message metadata rather than model-facing chat text. Suggested shape:

```ts
artifactOrigin?: {
  type: 'import';
  source: 'upload' | 'github';
  filename: string;
  importedAt: string;
  canonicalUrl?: string;
}
```

Do not duplicate the complete SCAD source in metadata.

### 4. AI continuity

Do not add a second prompt-injection mechanism for imported code.

The existing path is the contract:

```text
persisted artifact
  -> active parent_message_id branch
  -> convertToModelMessages()
  -> current complete build_parametric_model artifact
  -> model/OpenCode
  -> new complete build_parametric_model artifact
```

OpenCode already extracts the latest parametric artifact from the AI SDK prompt and exposes it as the authoritative current pCAD artifact. Imported artifacts must use the same shape so all providers receive them through existing machinery.

### 5. Artifact version field

Keep `version: "v1"` for the imported artifact and subsequent normal tool contract unless a separate versioning feature changes this later. pCAD's real history is the message tree plus conversation-workspace revisions, not incrementing the artifact `version` string.

### 6. No separate SCAD storage object required in V1

The complete source in `messages.parts` is sufficient as the authoritative imported model. Existing conversation-workspace model sync should discover successful imported build parts and mirror them to `models/current.scad` and immutable revisions.

Do not add a second authoritative SCAD copy merely for upload provenance.

## Upload policy

Use a dedicated SCAD import path rather than treating `.scad` as a generic chat attachment.

Initial source limit: `256_000` UTF-8 bytes, aligned with the existing server-side OpenSCAD validation limit.

Required validation:

- one file only in V1;
- filename ends in `.scad`, case-insensitive;
- check byte length before decoding;
- strict UTF-8 decode;
- allow/remove UTF-8 BOM;
- reject NUL/binary-like data;
- preserve source otherwise;
- dependency preflight before import completion;
- bounded OpenSCAD compile before entering the editor;
- create conversation + initial import messages as one controlled operation if practical.

Importing must not automatically start an AI turn. The user should first see the imported model and then issue an edit instruction.

## URL import security boundary

V1 should not implement a generic `fetch(userUrl)` endpoint.

Supported V1 URL forms:

- GitHub blob URL for a `.scad` file;
- raw GitHub `.scad` URL;
- GitHub Gist containing a `.scad` file.

Normalize a user URL into structured provider identifiers such as owner/repo/ref/path and then call fixed trusted GitHub endpoints. The server chooses the destination; user input must not become an arbitrary outbound URL.

Validate:

- scheme/host/provider form;
- owner/repository/ref/path structure;
- URL credentials are rejected;
- traversal/encoding edge cases;
- file extension/content;
- source byte limit;
- Gists with zero or multiple candidate `.scad` files;
- malformed blob/raw normalization.

Generic public HTTPS URL import is deferred. If added later it requires an explicitly hardened outbound-fetch primitive with private/loopback/link-local/reserved IP blocking, DNS-rebinding protection, redirect revalidation, timeout, streamed size limits, decompression limits, no credential forwarding and rate limiting.

## Dependency boundary

V1 supported:

- self-contained single-file SCAD;
- `include <BOSL2/...>` / `use <BOSL2/...>`;
- `include <BOSL/...>` / `use <BOSL/...>`;
- `include <MCAD/...>` / `use <MCAD/...>`.

V1 unsupported as imported project dependencies:

- relative/custom SCAD files such as `include <parts/custom.scad>`;
- custom `use <foo.scad>`;
- required `import("mesh.stl")` assets;
- required `import("logo.svg")` / DXF assets;
- multi-file projects and ZIP projects.

Dependency preflight must surface an explicit unsupported-dependency message instead of relying only on a later compiler failure.

Existing `OpenSCADViewer` mesh-file support is not sufficient to claim imported asset dependency support because it is in-memory and the AI tool worker does not share that file state.

## Future workspace design

V2 should extend the current workspace rather than replace it. Conceptual project representation:

```text
entrypoint: main.scad
files:
  main.scad
  parts/gears.scad
  assets/logo.svg
```

The same normalized project should later be materializable into browser WASM FS, the AI/tool compile worker, durable storage and the existing server conversation workspace.

V2 scope:

- multiple `.scad` files;
- ZIP projects;
- relative include/use;
- STL/SVG/DXF assets;
- workspace/file tree.

V3 scope:

- GitHub repository/directory import;
- dependency resolution;
- optional re-import/sync.

## Render/resource safety

Import broadens the amount of user-controlled OpenSCAD that pCAD executes. Resource protection is therefore a V1 prerequisite.

Current relevant workers:

- `useOpenSCAD()` owns a per-component preview worker;
- `toolWorker.ts` owns a long-lived singleton used by `build_parametric_model` compilation.

Both need bounded execution and recovery.

Initial policy:

- source limit: 256,000 UTF-8 bytes;
- compile timeout target: approximately 20 seconds;
- on timeout: terminate the worker, reject the request, clear pending requests, discard the worker instance and lazily create a fresh worker on the next operation;
- reset similarly on worker crash/message failure;
- add a reasonable output-size guard before very large STL/OFF output is handed further into parsing/rendering.

A pathological model such as one using extreme `$fn` must time out without permanently breaking later previews or AI builds.

## Existing capabilities that should be reused

Do not replace these systems during the feature:

- `ParametricArtifact` and `parametricArtifactSchema`;
- `tool-build_parametric_model` complete-artifact contract;
- `Tree`, `parent_message_id`, `current_message_leaf_id`;
- DB branch loading in `aiChat.ts`;
- `convertToModelMessages()`;
- OpenCode current-artifact extraction;
- parameter parsing/edit persistence;
- `OpenSCADPreview`;
- STL/DXF export;
- retry/edit/restore/branch navigation;
- conversation workspace model revisions/current source;
- bundled BOSL/BOSL2/MCAD loading.

`Fix with AI` exists inside `OpenSCADPreview`, but current `EditorView` does not appear to wire a `fixError` callback. Treat this as an existing wiring gap to verify/fix during regression work rather than assuming it already works end-to-end.

## Stepwise implementation plan

### Step 1 — Render safety foundation

Implement no import UI yet.

Work:

- shared source-size policy;
- preview-worker timeout and recovery;
- tool-worker timeout and recovery;
- pending-request cleanup;
- worker crash recovery;
- bounded output handling.

Verification:

- normal cube compiles;
- syntax error returns normally;
- pathological/extreme model times out;
- a normal model compiles immediately after timeout;
- AI tool compilation still works after a prior timeout;
- worker lifecycle tests cover multiple pending requests where applicable.

Gate: do not proceed to user-facing import until a timed-out worker recovers cleanly.

### Step 2 — Imported artifact persistence primitive

Add a narrow service/helper that creates the import-event message and synthetic completed/error assistant artifact using normal message-tree semantics.

Verification:

- correct parent chain;
- trigger/leaf ends at imported artifact;
- successful import is `output-available`;
- failed-but-retained import is `output-error`;
- no dangling `input-available` state;
- artifact extraction finds imported source;
- retry/restore/branching remain correct;
- conversation workspace sync discovers a successful imported artifact as a normal model revision.

Gate: imported artifact must be indistinguishable from a normal current artifact to existing editor/AI consumers.

### Step 3 — Local `.scad` upload

Add user-facing single-file import.

Work:

- file picker/drop entry point;
- `.scad`/size/UTF-8 validation;
- dependency preflight;
- bounded compile;
- conversation creation;
- imported message pair;
- navigation to editor and automatic current-preview selection.

Verification fixtures:

- self-contained `cube.scad`;
- BOSL2 model;
- BOSL model;
- MCAD model;
- syntax-broken SCAD;
- oversized SCAD;
- invalid UTF-8/binary input;
- relative custom include;
- STL/SVG asset dependency.

### Step 4 — AI continuation

Prove that normal editing operates from the imported complete artifact.

Core scenario:

```text
import bracket.scad
  -> "gör hålet 8 mm större"
  -> model receives exact current complete SCAD
  -> build_parametric_model returns complete modified SCAD
  -> preview/history updates normally
```

Verify at least:

- standard AI SDK provider;
- OpenCode CLI transport;
- OpenCode streaming transport;
- browser refresh before first edit;
- edit/retry/branching;
- parameter edit followed by AI edit;
- no duplicate or missing artifact state.

### Step 5 — GitHub/Gist URL import

Add provider-specific safe URL normalization and retrieval.

Verification:

- GitHub blob URL;
- raw GitHub URL;
- Gist with one `.scad`;
- unsupported/malformed GitHub URLs;
- excessive source size;
- traversal/encoding cases;
- Gist ambiguity;
- no arbitrary-host server fetch path exists.

### Step 6 — Full editor regression and product polish

Verify imported projects retain normal pCAD behavior:

- preview;
- parameter UI and persistence;
- conversation reload;
- history/branch navigation;
- retry/restore;
- Fix with AI wiring;
- STL export;
- DXF export;
- share flow;
- conversation workspace `current.scad`;
- immutable model revisions;
- no regression for ordinary non-imported conversations.

## Stop conditions

Do not silently expand V1 into a multi-file workspace implementation.

Stop and reassess before:

- adding generic outbound URL fetching;
- changing core message-tree semantics;
- introducing a second authoritative SCAD store;
- changing artifact version semantics;
- changing existing BOSL/BOSL2/MCAD loading behavior beyond what import requires;
- adding multi-file dependency resolution;
- changing normal prompt generation behavior unrelated to import.

## Completion criteria for V1

V1 is complete when a user can upload a supported single-file SCAD or import it from a supported GitHub/Gist URL, immediately see the model, refresh without losing it, ask the AI to modify it, receive a new complete artifact, navigate/retry/branch normally, adjust parsed parameters, and export the resulting model — while pathological SCAD cannot permanently wedge the preview or AI tool worker.
