# Deployment

The supported baseline is a user-owned checkout running `./start.sh` with a
rootless Docker-compatible runtime and the repository-local Supabase CLI.

For production, place the application behind HTTPS and an access-controlled
reverse proxy or private network. Supply configuration through the deployment
environment or an untracked `.env.local`; never bake secrets into the image or
repository. Provision persistent Supabase database and storage backups before
the first migration.

The public repository is promotion-only. Fixes are made in the engineering
source, requalified, exported and promoted as a new public release.
