<div align="center">
  <img src="./public/brepia-logo.svg" alt="Brepia" width="420" />
</div>

<h1 align="center">AI-assisted parametric and Creative 3D design</h1>

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-20.19%2B%20%7C%2022.12%2B-green.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E.svg?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![OpenSCAD](https://img.shields.io/badge/OpenSCAD-Parametric-F9D64F.svg?style=flat)](https://openscad.org/)

</div>

## About

Brepia is an open-source 3D design workspace built around AI-assisted modelling, editable OpenSCAD geometry and local or hosted model runtimes.

You can describe a model in natural language, inspect it in the 3D viewer, change exposed parameters, import existing OpenSCAD, use reference images and export the result for printing or further CAD work.

## Features

- Parametric 3D generation and editing with OpenSCAD.
- Editable dimensions, colours and other model parameters.
- Import of local `.scad` files and OpenSCAD sources from GitHub.
- Live 3D preview in the browser.
- Creative text-to-3D and image-to-3D workflows.
- Local and hosted AI providers, including OpenAI-compatible endpoints.
- OpenCode- and Codex-backed agent workflows.
- Configurable vision models for image and rendered-model analysis.
- Conversation workspaces that keep generated models, revisions and exports together.
- Self-hosted instance settings for operator, contact, community and legal links.

## Export formats

| Format | Use |
| --- | --- |
| **STL** | 3D printing and mesh workflows |
| **SCAD** | Editable OpenSCAD source |
| **DXF** | 2D CAD exchange |
| **STEP** | 3D CAD exchange |

Creative models can also provide mesh downloads such as GLB where supported.

## Requirements

For the normal local development setup:

- Node.js `^20.19.0` or `>=22.12.0`
- npm `>=10`
- Podman
- a NOx-managed local Supabase stack
- OpenCode if agent-backed OpenCode workflows are used
- llama-swap if local AI models are used

## Installation

Clone the repository and install the Node dependencies:

```bash
git clone https://github.com/weaf/pCAD.git
cd pCAD
npm install
cp .env.local.template .env.local
```

Fill in the provider or integration credentials you want to use in `.env.local`. Local Supabase connection values are read from the running local stack by `start.sh`.

Start the local Supabase stack through **NOx**. The project does not use `supabase start` or `npx supabase start` for its normal local workflow.

Apply repository migrations after Supabase is running:

```bash
npx supabase migration up
```

Start Brepia:

```bash
./start.sh
```

`start.sh` checks the local services, starts or connects to OpenCode, prepares the local runtime environment and launches the application in the stable production-like mode used for normal development and testing.

To run with Vite HMR instead:

```bash
PCAD_ENABLE_HMR=1 ./start.sh
```

## Local AI with llama-swap

Brepia can use models exposed through an OpenAI-compatible endpoint such as llama-swap. Provider URLs and credentials are configured from the application settings.

The default local llama-swap endpoint used by the Creative runtime is:

```text
http://127.0.0.1:9292
```

## Local Creative 3D

The native local Creative stack uses Z-Image-Turbo for text conditioning and TRELLIS.2 for 3D generation.

Install it with:

```bash
bash ./scripts/install-native-creative-backends.sh
```

By default the model weights are stored with the other llama-swap models:

```text
~/ai/llama-swap/models/creative/
├── z-image-turbo/
└── trellis2/
```

Runtime binaries are stored separately under:

```text
~/ai/pcad-native-creative/
```

A different model directory can be selected during installation:

```bash
bash ./scripts/install-native-creative-backends.sh \
  --models-dir /path/to/models
```

or with:

```bash
PCAD_NATIVE_CREATIVE_MODELS_DIR=/path/to/models \
bash ./scripts/install-native-creative-backends.sh
```

The installer adds the Creative runtimes to the existing llama-swap configuration. Restart or reload llama-swap afterwards and verify that the models are visible:

```bash
curl -s http://127.0.0.1:9292/v1/models \
  | grep -E 'creative/(z-image-turbo|trellis2)'
```

## STEP export

STEP export uses the repository's Podman sandbox. Build the image first:

```bash
./scripts/step-export/build-image.sh
```

Then point the application at the runner in `.env.local`:

```text
PCAD_STEP_EXPORT_RUNNER=/absolute/path/to/pCAD/scripts/step-export/pcad-scad2step-sandbox
```

Additional sandbox settings are documented in `.env.local.template`.

## Configuration

Start from:

```text
.env.local.template
```

Most AI provider credentials are optional. Configure only the providers and integrations you intend to use.

Model/provider configuration is also available inside Brepia, including custom OpenAI-compatible endpoints, local models, OpenCode agents and vision models.

## Development checks

Run the standard project checks before merging changes:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`src/routeTree.gen.ts` is generated by TanStack Router. Do not edit it by hand.

## Project origin

Brepia builds on the open-source [CADAM](https://github.com/Adam-CAD/CADAM) project and retains code derived from that work.

## License

Brepia is distributed under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE).
