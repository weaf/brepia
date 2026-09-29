# Brepia

Brepia is an open-source browser workspace for parametric and native BRep 3D
design. It combines editable OpenSCAD projects, constrained native BRep
projects, a live viewer, history, CAD exchange and optional local AI workflows.

## Install and run

Requirements: Node.js 20.19+ (or 22.12+), npm 10+, and a Docker-compatible
runtime supported by the Supabase CLI.

```bash
git clone https://github.com/weaf/brepia.git
cd brepia
npm ci
cp .env.example .env.local
./start.sh
```

Open the URL printed by the launcher. Configure only the providers and local
services you intend to use in `.env.local`; never commit that file.

## Supported distribution

The public repository is a generated release distribution. Product changes are
made in the engineering repository and promoted through the deterministic
exporter. See `DEPLOYMENT.md`, `MIGRATION.md` and `SECURITY.md` for release
operations and deployment boundaries.

## License and attribution

Brepia is distributed under the GNU General Public License v3.0. Required
upstream and third-party provenance is retained in `THIRD_PARTY_NOTICES.md`.
