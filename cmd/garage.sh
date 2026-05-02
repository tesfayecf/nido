#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_GARAGE_BIN="${ROOT_DIR}/third-party/garage/garage"
if [[ -z "${GARAGE_BIN:-}" && ! -x "${DEFAULT_GARAGE_BIN}" ]]; then
	DEFAULT_GARAGE_BIN="garage"
fi
GARAGE_BIN="${GARAGE_BIN:-${DEFAULT_GARAGE_BIN}}"
GARAGE_CONFIG="${ROOT_DIR}/config/garage.toml"
GARAGE_ZONE="${GARAGE_ZONE:-dc1}"
GARAGE_CAPACITY="${GARAGE_CAPACITY:-1G}"
GARAGE_LAYOUT_VERSION="${GARAGE_LAYOUT_VERSION:-1}"
GARAGE_KEY_NAME="${GARAGE_KEY_NAME:-nido-dev}"
GARAGE_BUCKET_NAME="${NIDO_S3_BUCKET:-nido-dev}"

usage() {
	cat <<'EOF'
Usage: cmd/garage.sh <command> [args]

Commands:
	start                          Start the Garage server with the local config.
	status                         Show Garage status.
	layout-assign <node-id>        Assign the local layout for one node.
	layout-apply                   Apply the current layout version.
	key-create [key-name]          Create one S3 access key.
	bucket-create [bucket-name]    Create one S3 bucket.
	bucket-allow [key] [bucket]    Grant owner/read/write access.
	dev-setup <node-id> [key] [bucket]
																 Assign layout, apply it, create the key, create the bucket,
																 and grant access in one pass.
EOF
}

ensure_garage() {
	if [[ "${GARAGE_BIN}" == */* ]]; then
		if [[ ! -x "${GARAGE_BIN}" ]]; then
			echo "Garage binary not found at ${GARAGE_BIN}" >&2
			exit 1
		fi
		return
	fi

	if ! command -v "${GARAGE_BIN}" >/dev/null 2>&1; then
		echo "Garage binary not found: ${GARAGE_BIN}" >&2
		exit 1
	fi
}

run_garage() {
	ensure_garage
	(
		cd "${ROOT_DIR}"
		mkdir -p .garage/meta .garage/data
		"${GARAGE_BIN}" -c "${GARAGE_CONFIG}" "$@"
	)
}

command_name="${1:-}"
case "${command_name}" in
	start)
		run_garage server
		;;
	status)
		run_garage status
		;;
	layout-assign)
		node_id="${2:-${GARAGE_NODE_ID:-}}"
		if [[ -z "${node_id}" ]]; then
			echo "node id is required for layout-assign" >&2
			exit 1
		fi
		run_garage layout assign -z "${GARAGE_ZONE}" -c "${GARAGE_CAPACITY}" "${node_id}"
		;;
	layout-apply)
		run_garage layout apply --version "${GARAGE_LAYOUT_VERSION}"
		;;
	key-create)
		run_garage key create "${2:-${GARAGE_KEY_NAME}}"
		;;
	bucket-create)
		run_garage bucket create "${2:-${GARAGE_BUCKET_NAME}}"
		;;
	bucket-allow)
		key_name="${2:-${GARAGE_KEY_NAME}}"
		bucket_name="${3:-${GARAGE_BUCKET_NAME}}"
		run_garage bucket allow --read --write --owner "${bucket_name}" --key "${key_name}"
		;;
	dev-setup)
		node_id="${2:-${GARAGE_NODE_ID:-}}"
		key_name="${3:-${GARAGE_KEY_NAME}}"
		bucket_name="${4:-${GARAGE_BUCKET_NAME}}"
		if [[ -z "${node_id}" ]]; then
			echo "node id is required for dev-setup" >&2
			exit 1
		fi
		run_garage layout assign -z "${GARAGE_ZONE}" -c "${GARAGE_CAPACITY}" "${node_id}"
		run_garage layout apply --version "${GARAGE_LAYOUT_VERSION}"
		run_garage key create "${key_name}"
		run_garage bucket create "${bucket_name}"
		run_garage bucket allow --read --write --owner "${bucket_name}" --key "${key_name}"
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
