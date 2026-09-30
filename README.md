# Brepia

Brepia is an open-source browser workspace for parametric and native BRep 3D
design. It includes editable OpenSCAD projects, native BRep projects, a live
3D viewer, project history, CAD exchange and optional AI-assisted workflows.

## Capabilities

- Create, edit, import and export OpenSCAD projects.
- Create and revise native BRep projects with editable parameters and project history.
- View models in the browser and export STL, SCAD, DXF, STEP and 3DM files.
- Use local or hosted AI providers, OpenCode or other OpenAI-compatible services when configured.

## Requirements

- Podman

Docker can also be used, but the included launcher is set up for Podman by
default and needs small container/socket adjustments for Docker.

## Install and run

```bash
git clone https://github.com/weaf/brepia.git
cd brepia
./setup.sh --non-interactive --minimal
./start.sh
```

Open the URL printed by the launcher. The launcher starts the repository-local
Supabase services and the application. Keep `.env.local` private.

## Optional AI services

Brepia starts without local AI services. Set provider credentials or endpoint
URLs in `.env.local` for hosted providers. Install OpenCode or run an
OpenAI-compatible service separately when you want those integrations.

## Configuration

Use `.env.local` for provider credentials, service URLs and optional feature
settings.

## License

Brepia is distributed under the GNU General Public License v3.0. See
[`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
