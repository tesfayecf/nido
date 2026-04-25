#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GO_BIN="${GO_BIN:-${ROOT_DIR}/third-party/go/bin/go}"
PNPM_BIN="${PNPM_BIN:-pnpm}"
SERVER_DIR="${ROOT_DIR}/server"
APP_DIR="${ROOT_DIR}/app"
SERVER_BIN="${SERVER_BIN:-${SERVER_DIR}/.install/bin/server}"
DATABASE_PATH="${HS_DATABASE_PATH:-${ROOT_DIR}/.sqlite/home-searcher.db}"
BACKEND_HTTP_ADDR="${HS_HTTP_ADDR:-:8080}"
APP_API_ORIGIN="${APP_API_ORIGIN:-${VITE_API_ORIGIN:-http://127.0.0.1:8080}}"
APP_DEV_BACKEND_ORIGIN="${APP_DEV_BACKEND_ORIGIN:-${VITE_BACKEND_ORIGIN:-${APP_API_ORIGIN}}}"
APP_PREVIEW_HOST="${APP_PREVIEW_HOST:-127.0.0.1}"
APP_PREVIEW_PORT="${APP_PREVIEW_PORT:-4173}"
BACKGROUND_PID=""

usage() {
	cat <<'EOF'
Usage: cmd/home-searcher.sh <command>

Commands:
	config                    Print the resolved tool and runtime configuration.
	backend-build             Build the production backend binary.
	backend-run               Run the built backend binary.
	backend-dev               Run the backend with go run.
	backend-migrate           Run backend migrations.
	backend-test              Run backend tests.
	frontend-install          Install frontend dependencies.
	frontend-dev              Run the frontend Vite dev server.
	frontend-build            Build the frontend bundle.
	frontend-preview          Run the frontend preview server.
	frontend-typecheck        Run frontend type checking.
	frontend-test             Run frontend tests.
	frontend-lint             Run frontend lint.
	app-build                 Build the backend binary and frontend bundle.
	app-dev                   Run backend go run and frontend dev together.
	app-start                 Build both sides and run backend + frontend preview.

Environment:
	GO_BIN                    Path to the Go toolchain. Default: ./third-party/go/bin/go
	PNPM_BIN                  pnpm executable to use. Default: pnpm
	SERVER_BIN                Backend binary output path. Default: ./server/.install/bin/server
	HS_DATABASE_PATH          SQLite database path. Default: ./.sqlite/home-searcher.db
	HS_HTTP_ADDR              Backend listen address. Default: :8080
	APP_API_ORIGIN            Frontend API origin baked into the build. Default: http://127.0.0.1:8080
	APP_DEV_BACKEND_ORIGIN    Backend origin used by Vite dev proxy. Default: APP_API_ORIGIN
	APP_PREVIEW_HOST          Host passed to vite preview. Default: 127.0.0.1
	APP_PREVIEW_PORT          Port passed to vite preview. Default: 4173

Any additional HS_* or VITE_* environment variables are forwarded to the
underlying backend and frontend commands.
EOF
}

log() {
	printf '==> %s\n' "$*"
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

ensure_path_parent() {
	mkdir -p "$(dirname "$1")"
}

run_go() {
	ensure_command "${GO_BIN}" "Go toolchain"
	GOTOOLCHAIN=local "${GO_BIN}" "$@"
}

backend_env() {
	HS_DATABASE_PATH="${HS_DATABASE_PATH:-${DATABASE_PATH}}" \
	HS_HTTP_ADDR="${HS_HTTP_ADDR:-${BACKEND_HTTP_ADDR}}" \
	"$@"
}

frontend_build_env() {
	VITE_API_ORIGIN="${VITE_API_ORIGIN:-${APP_API_ORIGIN}}" "$@"
}

frontend_dev_env() {
	VITE_BACKEND_ORIGIN="${VITE_BACKEND_ORIGIN:-${APP_DEV_BACKEND_ORIGIN}}" "$@"
}

print_config() {
	cat <<EOF
ROOT_DIR=${ROOT_DIR}
GO_BIN=${GO_BIN}
PNPM_BIN=${PNPM_BIN}
SERVER_BIN=${SERVER_BIN}
HS_DATABASE_PATH=${DATABASE_PATH}
HS_HTTP_ADDR=${BACKEND_HTTP_ADDR}
APP_API_ORIGIN=${APP_API_ORIGIN}
APP_DEV_BACKEND_ORIGIN=${APP_DEV_BACKEND_ORIGIN}
APP_PREVIEW_HOST=${APP_PREVIEW_HOST}
APP_PREVIEW_PORT=${APP_PREVIEW_PORT}
EOF
}

backend_build() {
	log "Building backend binary"
	ensure_path_parent "${SERVER_BIN}"
	(
		cd "${SERVER_DIR}"
		run_go build -trimpath -ldflags="-s -w" -o "${SERVER_BIN}" ./cmd/server
	)
}

backend_run() {
	if [[ ! -x "${SERVER_BIN}" ]]; then
		echo "backend binary not found at ${SERVER_BIN}; run backend-build first" >&2
		exit 1
	fi

	log "Running backend binary"
	ensure_path_parent "${DATABASE_PATH}"
	(
		cd "${ROOT_DIR}"
		backend_env "${SERVER_BIN}"
	)
}

backend_dev() {
	log "Running backend with go run"
	ensure_path_parent "${DATABASE_PATH}"
	(
		cd "${SERVER_DIR}"
		backend_env run_go run ./cmd/server
	)
}

backend_migrate() {
	log "Running backend migrations"
	ensure_path_parent "${DATABASE_PATH}"
	(
		cd "${SERVER_DIR}"
		backend_env run_go run ./cmd/server migrate
	)
}

backend_test() {
	log "Running backend tests"
	(
		cd "${SERVER_DIR}"
		run_go test ./...
	)
}

frontend_install() {
	log "Installing frontend dependencies"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		"${PNPM_BIN}" install
	)
}

frontend_dev() {
	log "Running frontend dev server"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		frontend_dev_env "${PNPM_BIN}" dev
	)
}

frontend_build() {
	log "Building frontend bundle"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		frontend_build_env "${PNPM_BIN}" build
	)
}

frontend_preview() {
	log "Running frontend preview"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		"${PNPM_BIN}" preview -- --host "${APP_PREVIEW_HOST}" --port "${APP_PREVIEW_PORT}"
	)
}

frontend_typecheck() {
	log "Running frontend typecheck"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		"${PNPM_BIN}" typecheck
	)
}

frontend_test() {
	log "Running frontend tests"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		"${PNPM_BIN}" test
	)
}

frontend_lint() {
	log "Running frontend lint"
	ensure_command "${PNPM_BIN}" "pnpm"
	(
		cd "${APP_DIR}"
		"${PNPM_BIN}" lint
	)
}

cleanup_background() {
	if [[ -n "${BACKGROUND_PID}" ]] && kill -0 "${BACKGROUND_PID}" >/dev/null 2>&1; then
		kill "${BACKGROUND_PID}" >/dev/null 2>&1 || true
		wait "${BACKGROUND_PID}" >/dev/null 2>&1 || true
	fi
}

app_build() {
	backend_build
	frontend_build
}

app_dev() {
	backend_dev &
	BACKGROUND_PID=$!
	trap cleanup_background EXIT INT TERM
	frontend_dev
}

app_start() {
	app_build
	backend_run &
	BACKGROUND_PID=$!
	trap cleanup_background EXIT INT TERM
	frontend_preview
}

command_name="${1:-help}"
case "${command_name}" in
	config)
		print_config
		;;
	backend-build)
		backend_build
		;;
	backend-run)
		backend_run
		;;
	backend-dev)
		backend_dev
		;;
	backend-migrate)
		backend_migrate
		;;
	backend-test)
		backend_test
		;;
	frontend-install)
		frontend_install
		;;
	frontend-dev)
		frontend_dev
		;;
	frontend-build)
		frontend_build
		;;
	frontend-preview)
		frontend_preview
		;;
	frontend-typecheck)
		frontend_typecheck
		;;
	frontend-test)
		frontend_test
		;;
	frontend-lint)
		frontend_lint
		;;
	app-build|build)
		app_build
		;;
	app-dev|dev)
		app_dev
		;;
	app-start|start)
		app_start
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