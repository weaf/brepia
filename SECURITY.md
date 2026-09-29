# Security

Report suspected vulnerabilities privately to the repository maintainers rather
than opening a public issue with exploit details. Do not include credentials,
tokens, private keys or customer data in reports.

Deploy behind HTTPS and an access-controlled network boundary. Keep Supabase,
provider credentials and local model endpoints private; only expose the
application endpoint required by your deployment. Rotate credentials after any
suspected disclosure and keep dependencies and container images current.

The public tree is generated from a qualified engineering source. A release
must pass the exporter secret, legacy-name and local-path scans before it is
promoted.
