<div align="center">
  <img src="./public/brepia-logo.svg" alt="Brepia" width="420" />
</div>

<h1 align="center">Brepia</h1>

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-20.19%2B%20%7C%2022.12%2B-green.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat)](https://react.dev/)
[![OpenSCAD](https://img.shields.io/badge/OpenSCAD-Parametric-F9D64F.svg?style=flat)](https://openscad.org/)

</div>

Brepia is an open-source browser-based workspace for parametric and Creative 3D design. It combines editable OpenSCAD projects, constrained native BRep projects, a live 3D viewer, model history, import/export tools and optional AI-assisted workflows in one application.

## Features

- Create and revise parametric OpenSCAD models and multi-file projects.
- Edit dimensions, colours and other model parameters.
- Import standalone `.scad` files, local OpenSCAD project folders and bounded same-repository OpenSCAD projects from GitHub.
- Preserve project-local `.scad` dependencies and explicitly supported relative assets referenced by `import()` / `surface()`.
- Inspect and directly edit project `.scad` source files, including the declared entrypoint and non-entrypoint support files, from the existing Parametric editor.
- Create, import, export and revise canonical native BRep projects without exposing arbitrary Python as project source.
- Edit native BRep published parameters, feature DAG nodes, dependencies, result selection, placement and object metadata through immutable project revisions.
- Inspect BRep dependency graphs and directly author project-object semantics such as footprint, clearance/maintenance roles and stable local connection, mounting and cable points.
- Evaluate native BRep geometry in an isolated build123d/OCCT sandbox and export exact primary-result STEP directly from that native path.
- Export Rhino/openNURBS `.3dm` interoperability files containing viewable Result/project-object meshes, semantic points and Brepia metadata, with the exact primary STEP embedded for CAD-fidelity handoff.
- Use complete canonical BRep snapshots in supported AI, OpenCode and Codex editing workflows while preserving stable project/node/parameter/object identities.
- Inspect models in a live browser-based 3D viewer.
- Use text or reference images in Creative 3D workflows.
- Work with local or hosted model providers, including OpenAI-compatible endpoints.
- Use OpenCode- or Codex-backed agent workflows where configured.
- Keep generated models, complete project revisions and exports in conversation workspaces.
- Configure model providers, profiles, vision models and instance settings from the application.

## Export formats

| Format   | Use                                           |
| -------- | --------------------------------------------- |
| **STL**  | 3D printing and mesh workflows                |
| **SCAD** | Editable OpenSCAD source                      |
| **DXF**  | 2D CAD exchange                               |
| **STEP** | Exact native BRep CAD exchange                |
| **3DM**  | Rhino/openNURBS interoperability and semantics |

Creative workflows can also provide GLB output when supported by the selected backend. Native BRep projects can additionally export their canonical Brepia project package for lossless Brepia round trips.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- npm `>=10`
- Podman or another Docker-compatible runtime supported by the Supabase CLI

Some optional workflows require additional local services such as OpenCode, llama-swap or a Creative 3D backend.

## Installation

```bash
git clone https://github.com/weaf/brepia.git
cd brepia
npm ci
cp .env.local.template .env.local
```

Configure the services and providers you want to use in `.env.local`, then start Brepia:

```bash
./start.sh
```

The Supabase CLI is included as a project dependency, so a global `supabase` installation is not required.

For local database setup and migration details, see [`docs/local_supabase_lifecycle.md`](docs/local_supabase_lifecycle.md).

## Optional local services

### Native BRep

Build the pinned build123d/OCCT/rhino3dm evaluation and interoperability sandbox with:

```bash
./scripts/brep/build-image.sh
```

Then configure the native BRep runner as documented in `.env.local.template`. The repository smoke test is:

```bash
./scripts/brep/smoke-test.sh
```

### Creative 3D

Install the supported local Creative runtime with:

```bash
bash ./scripts/install-native-creative-backends.sh
```

See [`docs/local_creative_mesh_backends.md`](docs/local_creative_mesh_backends.md) for configuration details.

### STEP export

Build the OpenSCAD/scad123d STEP export sandbox with:

```bash
./scripts/step-export/build-image.sh
```

Then configure `PCAD_STEP_EXPORT_RUNNER` in `.env.local`. Available settings are documented in `.env.local.template`.

## Development

Before submitting changes, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

`src/routeTree.gen.ts` is generated by TanStack Router and should not be edited manually.

## CADAM attribution

Brepia is based on and evolved from the open-source **CADAM** project by Adam-CAD. The project retains code, design and architectural lineage from CADAM, and that upstream work made Brepia possible.

Upstream project: [Adam-CAD/CADAM](https://github.com/Adam-CAD/CADAM)

## License

Brepia is distributed under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE).
