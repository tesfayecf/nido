#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_GO_BIN="${ROOT_DIR}/third-party/go/bin/go"
if [[ -z "${GO_BIN:-}" && ! -x "${DEFAULT_GO_BIN}" ]]; then
	DEFAULT_GO_BIN="go"
fi
GO_BIN="${GO_BIN:-${DEFAULT_GO_BIN}}"
DATABASE_PATH="${NIDO_DATABASE_PATH:-${ROOT_DIR}/.sqlite/nido.db}"

usage() {
	cat <<'EOF'
Usage: cmd/sqlite.sh <command> [args]

Commands:
	path                  Print the resolved SQLite database path.
	migrate               Run the server migration command.
	tables                List database tables with sqlite3.
	query <sql>           Execute one SQL statement with sqlite3.
EOF
}

ensure_sqlite_cli() {
	if ! command -v sqlite3 >/dev/null 2>&1; then
		echo "sqlite3 is required for this command" >&2
		exit 1
	fi
}

ensure_command() {
	local executable="$1"
	local label="$2"

	if [[ "${executable}" == */* ]]; then
		if [[ ! -x "${executable}" ]]; then
			echo "${label} not found at ${executable}" >&2
			exit 1
		fi
		return
	fi

	if ! command -v "${executable}" >/dev/null 2>&1; then
		echo "${label} not found: ${executable}" >&2
		exit 1
	fi
}

run_go() {
	ensure_command "${GO_BIN}" "Go toolchain"
	GOTOOLCHAIN=local "${GO_BIN}" "$@"
}

command_name="${1:-}"
case "${command_name}" in
	path)
		printf '%s\n' "${DATABASE_PATH}"
		;;
	migrate)
		mkdir -p "$(dirname "${DATABASE_PATH}")"
		(
			cd "${ROOT_DIR}/server"
			NIDO_DATABASE_PATH="${DATABASE_PATH}" run_go run ./cmd/server migrate
		)
		;;
	tables)
		ensure_sqlite_cli
		sqlite3 "${DATABASE_PATH}" "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
		;;
	query)
		ensure_sqlite_cli
		if [[ $# -lt 2 ]]; then
			echo "query requires one SQL argument" >&2
			exit 1
		fi
		shift
		sqlite3 "${DATABASE_PATH}" "$*"
		;;
	""|-h|--help|help)
		usage
		;;
	*)
		echo "unknown command: ${command_name}" >&2
		usage >&2
		exit 1
		;;
esac
