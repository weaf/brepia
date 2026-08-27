<div align="center">
  <img src="./public/brepia-logo.svg" alt="Brepia by Noty" width="420" />
</div>

<h1 align="center">AI-assisted parametric 3D design</h1>

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-20.19%2B%20%7C%2022.12%2B-green.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E.svg?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![OpenSCAD](https://img.shields.io/badge/OpenSCAD-Parametric-F9D64F.svg?style=flat)](https://openscad.org/)

</div>

---

## Brepia

**Brepia** is an AI-assisted parametric 3D design environment built around editable OpenSCAD geometry.
Describe what you want to make, inspect and refine the generated model, adjust extracted parameters,
bring in reference images or existing geometry, and export the result for fabrication or downstream CAD work.

The product identity is **Brepia by Noty**. The repository is still named `weaf/pCAD` while the product
rename and its compatibility boundaries are completed.

Brepia is currently distributed as **open-source software**, not as one centrally operated hosted service.
Self-hosted deployments may optionally publish their own operator/contact/community/legal information through
administrator-controlled **Instance identity** settings. A fresh installation claims none of those by default.

## What Brepia does

- **AI-assisted parametric modelling** — generate and edit OpenSCAD-based models from natural-language intent.
- **Editable parameters** — expose dimensions, colours and other values as interactive controls without regenerating the whole model.
- **OpenSCAD import and editing** — import local `.scad` files or GitHub-hosted OpenSCAD sources and continue working with them.
- **Reference inputs** — use images and supported mesh inputs as context for modelling workflows.
- **Live 3D preview** — compile and inspect models in the browser while parameters change.
- **Multiple AI runtimes** — use configured hosted models, local OpenAI-compatible runtimes, OpenCode agents and Codex-oriented workflows through the model/provider settings architecture.
- **CLI or streaming OpenCode execution** — choose the transport style for supported OpenCode-backed models.
- **Vision routing** — configure vision-capable models for reference-image and deeper rendered-model inspection workflows.
- **Conversation workspace** — keep model generation, revisions, parameters and exports tied to the working conversation.

## Export formats

Brepia currently supports the following parametric export paths:

| Format | Typical use |
| --- | --- |
| **STL** | 3D printing and mesh workflows |
| **SCAD** | Editable OpenSCAD source |
| **DXF** | 2D projection / CAD exchange |
| **STEP** | General-purpose CAD exchange, with analytic geometry where supported and controlled fallback where required |

Creative mesh workflows also expose additional mesh/download formats where supported by the selected model.

## Product structure

The main workflow combines:

1. **Chat / intent** — describe or refine the model.
2. **3D preview** — inspect generated parametric or mesh output.
3. **Parameters** — adjust extracted values directly.
4. **Code** — retain OpenSCAD as an inspectable and exportable source representation.
5. **Agent/model settings** — choose hosted, local or agent-backed execution paths.

Brepia deliberately keeps AI generation and editable geometry connected: the goal is not only to produce a mesh,
but to preserve useful design intent and parameters whenever the workflow allows it.

## Quick start

```bash
# Clone the current repository
git clone https://github.com/weaf/pCAD.git
cd pCAD

# Install dependencies
npm install

# Copy local configuration
cp .env.local.template .env.local

# Start local Supabase services
npx supabase start

# Apply any migrations added since the local database was created
npx supabase migration up

# Start the application
npm run dev
```

The project has additional local-runtime and integration options. Use the repository's current `.env.local.template`
and the relevant documents under `docs/` as the source of truth instead of copying environment values from old CADAM setup guides.

The Brepia remake adds `supabase/migrations/20260827062000_instance_identity_settings.sql`; an existing local
database must apply that migration before the Instance identity admin panel can persist settings.

## Instance identity and self-hosting

Instance-specific public identity is deliberately separate from Brepia's product branding.
An administrator can optionally configure:

- operator / organization name;
- public contact email;
- community label and URL;
- external Terms URL;
- external Privacy URL;
- whether community/legal links are exposed.

The default is neutral: no operator, contact, community or hosted-service legal links are shown.
The underlying singleton settings table is server-managed; browser clients receive only the public whitelist through
the application API.

This lets a self-hoster present its own deployment accurately without implying that the Brepia open-source project
itself is the operator or legal party for every installation.

## Validation

Before merging application changes, run the normal project gate:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

When adding or changing file-based TanStack routes, start the Vite development server once so the generator refreshes
`src/routeTree.gen.ts`, then include the generated route-tree diff if it changes before the final typecheck/build gate.

Feature-specific plans and status documents under `docs/` may require additional focused verification.

## Local and agent-backed AI

Brepia supports a progressively configurable AI stack rather than assuming one hosted provider. Depending on the
installation, the model catalog can include:

- built-in or hosted providers;
- custom OpenAI-compatible providers;
- local model runtimes;
- OpenCode-backed agents;
- Codex-oriented agent entries;
- dedicated vision models.

Runtime availability and user-visible models are managed through the application's settings/catalog layers.
Compatibility-sensitive internal identifiers are intentionally not renamed merely because the product is now Brepia.

## OpenSCAD and parametric editing

OpenSCAD remains an important representation inside Brepia:

- generated code can expose parameters for direct editing;
- imported OpenSCAD can be brought into the same workflow;
- browser-side preview and export paths use OpenSCAD semantics;
- library/import handling is preserved where the execution path supports it.

See the OpenSCAD import/editing plans and status documents under `docs/` for implementation details and current constraints.

## STEP export

STEP export is implemented as a separate CAD exchange path rather than pretending an STL mesh is a STEP model.
The exporter attempts to preserve suitable analytic geometry and can use controlled fallback geometry for operations
that cannot remain analytic.

Operational settings and implementation details remain documented in the STEP-related files under `docs/` and the
corresponding server/export code.

## Benchmarks and examples

The repository retains the existing parametric benchmark set under [`benchmarks/`](benchmarks/). Those models are useful
for regression and capability comparisons even when an individual artifact records historical CADAM-era output.

Historical naming inside benchmark evidence should not be globally replaced when it describes the original result or source context.

## Brepia branding

The current product branding is maintained through shared assets/components rather than one-off feature graphics:

- `src/components/brand/BrepiaMark.tsx`
- `src/components/brand/BrepiaBrand.tsx`
- `src/components/brand/ActivityIndicator.tsx`
- `public/brepia-mark.svg`
- `public/brepia-logo.svg`
- `public/brepia-watermark.svg`
- `docs/brepia_branding.md`

The repository, deployment path and internal `pCAD`/`PCAD_*` compatibility identifiers are separate migration decisions.
See `docs/brepia_remake_plan.md` and `docs/brepia_remake_status.md` before performing broad renames.

## Project origin and upstream attribution

Brepia evolved from the open-source **CADAM** project by Adam-CAD and continues to carry code and design lineage from that work.
The upstream project is available at:

- https://github.com/Adam-CAD/CADAM

This repository has diverged substantially through additional parametric editing, local/agent model routing, OpenSCAD import workflows,
STEP export and other product-specific work. Historical CADAM references are retained where they are needed for attribution,
compatibility or an accurate development record.

## License

This project is distributed under the **GNU General Public License v3.0**. See [`LICENSE`](LICENSE) for the repository license text.

---

<div align="center">
  <strong>Brepia</strong><br />
  <sub>by Noty</sub>
</div>
