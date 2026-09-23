#!/usr/bin/env bash
set -euo pipefail

BREPIA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BREPIA_LOCAL_STATE_DIR="${BREPIA_ROOT}/.brepia"
BREPIA_SUPABASE_PORT_FILE="${BREPIA_LOCAL_STATE_DIR}/supabase-ports.env"
BREPIA_SUPABASE_REQUIRED_PORT_LAYOUT_VERSION=1

brepia_supabase_port_names() {
  cat <<'EOF'
BREPIA_SUPABASE_API_PORT
BREPIA_SUPABASE_DB_PORT
BREPIA_SUPABASE_SHADOW_PORT
BREPIA_SUPABASE_POOLER_PORT
BREPIA_SUPABASE_EDGE_INSPECTOR_PORT
BREPIA_SUPABASE_STUDIO_PORT
BREPIA_SUPABASE_LOCAL_SMTP_PORT
BREPIA_SUPABASE_SMTP_PORT
BREPIA_SUPABASE_POP3_PORT
BREPIA_SUPABASE_ANALYTICS_PORT
EOF
}

brepia_load_supabase_ports() {
  if [[ ! -s "${BREPIA_SUPABASE_PORT_FILE}" ]]; then
    return 1
  fi

  unset BREPIA_SUPABASE_PORT_LAYOUT_VERSION
  # shellcheck disable=SC1090
  source "${BREPIA_SUPABASE_PORT_FILE}"

  if [[ "${BREPIA_SUPABASE_PORT_LAYOUT_VERSION:-0}" != "${BREPIA_SUPABASE_REQUIRED_PORT_LAYOUT_VERSION}" ]]; then
    return 1
  fi

  local name value
  local seen=" "
  while IFS= read -r name; do
    value="${!name-}"
    if [[ ! "${value}" =~ ^[0-9]+$ ]] || (( value < 1 || value > 65535 )); then
      return 1
    fi
    if [[ "${seen}" == *" ${value} "* ]]; then
      return 1
    fi
    seen+="${value} "
    export "${name}"
  done < <(brepia_supabase_port_names)
  export BREPIA_SUPABASE_PORT_LAYOUT_VERSION
}

brepia_allocate_supabase_ports() {
  mkdir -p "${BREPIA_LOCAL_STATE_DIR}"
  local temporary="${BREPIA_SUPABASE_PORT_FILE}.tmp"

  node --input-type=module > "${temporary}" <<'NODE'
import net from 'node:net';

const layoutVersion = 1;
const names = [
  'BREPIA_SUPABASE_API_PORT',
  'BREPIA_SUPABASE_DB_PORT',
  'BREPIA_SUPABASE_SHADOW_PORT',
  'BREPIA_SUPABASE_POOLER_PORT',
  'BREPIA_SUPABASE_EDGE_INSPECTOR_PORT',
  'BREPIA_SUPABASE_STUDIO_PORT',
  'BREPIA_SUPABASE_LOCAL_SMTP_PORT',
  'BREPIA_SUPABASE_SMTP_PORT',
  'BREPIA_SUPABASE_POP3_PORT',
  'BREPIA_SUPABASE_ANALYTICS_PORT',
];

const servers = [];
const ports = [];
try {
  for (const name of names) {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error(`Could not allocate ${name}`);
    servers.push(server);
    ports.push(address.port);
  }

  process.stdout.write(`BREPIA_SUPABASE_PORT_LAYOUT_VERSION=${layoutVersion}\n`);
  for (let index = 0; index < names.length; index += 1) {
    process.stdout.write(`${names[index]}=${ports[index]}\n`);
  }
} finally {
  await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
}
NODE

  mv "${temporary}" "${BREPIA_SUPABASE_PORT_FILE}"
  chmod 600 "${BREPIA_SUPABASE_PORT_FILE}" 2>/dev/null || true
  brepia_load_supabase_ports
  export BREPIA_SUPABASE_PORT_LAYOUT_CREATED=1
  echo "Supabase: allocated checkout-local ports (API ${BREPIA_SUPABASE_API_PORT}, DB ${BREPIA_SUPABASE_DB_PORT}, Studio ${BREPIA_SUPABASE_STUDIO_PORT})."
}

brepia_ensure_supabase_ports() {
  if brepia_load_supabase_ports; then
    export BREPIA_SUPABASE_PORT_LAYOUT_CREATED="${BREPIA_SUPABASE_PORT_LAYOUT_CREATED:-0}"
    return 0
  fi

  echo "Supabase: local port layout missing or invalid; allocating isolated ports..."
  brepia_allocate_supabase_ports
}

brepia_remove_stale_project_containers() {
  if ! command -v podman >/dev/null 2>&1; then
    return 0
  fi

  local ids=()
  mapfile -t ids < <(podman ps -aq --filter label=com.supabase.cli.project=brepia)
  if (( ${#ids[@]} == 0 )); then
    return 0
  fi

  echo "Supabase: removing ${#ids[@]} stopped/stale Brepia container(s); persistent volumes are preserved."
  podman rm -f "${ids[@]}" >/dev/null
}

brepia_migrate_legacy_port_layout() {
  # A newly allocated port bundle replaces the historical fixed-port layout.
  # Ask the CLI to stop cleanly first, then remove only project-labelled
  # containers that Podman may retain in a prolonged stopping state. Volumes
  # are intentionally never removed here.
  brepia_supabase_cli stop >/dev/null 2>&1 || true
  brepia_remove_stale_project_containers
}

brepia_supabase_cli() {
  PATH="${BREPIA_ROOT}/scripts/podman:${PATH}" npx supabase "$@"
}

brepia_supabase_start() {
  brepia_supabase_cli start "$@"
}

brepia_supabase() {
  brepia_ensure_supabase_ports >/dev/null
  if [[ "${1:-}" == "start" ]]; then
    shift
    brepia_supabase_start "$@"
    return
  fi
  brepia_supabase_cli "$@"
}

brepia_supabase_status_env() {
  brepia_supabase status -o env
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  brepia_supabase "$@"
fi
