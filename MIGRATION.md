# Migration to Brepia 2.0

Brepia 2.0 is the public distribution of the qualified v1.8 engineering
source. Existing Brepia data remains application-managed through the supported
Supabase migrations.

Before upgrading, back up the database and storage configured for your
installation. Install the new tree into a fresh checkout, copy your sanitized
`.env.local` settings, apply the repository migrations through the supported
Supabase lifecycle, and verify sign-in, saved workspaces and exports.

Do not copy engineering `.dquark`, evidence, test-result or local credential
files into a public deployment.
