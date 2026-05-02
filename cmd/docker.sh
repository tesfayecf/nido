#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_BIN="${DOCKER_BIN:-docker}"
DOCKER_IMAGE_REPOSITORY="${NIDO_DOCKER_IMAGE_REPOSITORY:-tesfayecf/nido}"
DOCKER_PLATFORM="${NIDO_DOCKER_PLATFORM:-linux/arm64}"
DOCKERFILE_PATH="${NIDO_DOCKERFILE_PATH:-${ROOT_DIR}/docker/Dockerfile}"
DOCKER_CONTEXT_PATH="${NIDO_DOCKER_CONTEXT_PATH:-${ROOT_DIR}}"

usage() {
	cat <<'EOF'
Usage: cmd/docker.sh <command> [args]

Commands:
	build-tar <tag> <path>    Build the arm64 Docker image, tag it, and save it as a tar archive.

Environment:
	DOCKER_BIN                docker executable to use. Default: docker
	NIDO_DOCKER_IMAGE_REPOSITORY
	                         Image repository. Default: tesfayecf/nido
	NIDO_DOCKER_PLATFORM      Build platform. Default: linux/arm64
	NIDO_DOCKERFILE_PATH      Dockerfile path. Default: ./docker/Dockerfile
	NIDO_DOCKER_CONTEXT_PATH  Docker build context. Default: repository root
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

sanitize_tag_for_filename() {
	local image_tag="$1"
	local sanitized_tag="${image_tag//\//-}"
	sanitized_tag="${sanitized_tag//:/-}"
	sanitized_tag="${sanitized_tag//@/-}"
	sanitized_tag="${sanitized_tag// /-}"
	printf '%s\n' "${sanitized_tag}"
}

resolve_archive_path() {
	local output_path="$1"
	local image_tag="$2"
	local sanitized_tag

	sanitized_tag="$(sanitize_tag_for_filename "${image_tag}")"
	if [[ "${output_path}" == *.tar ]]; then
		mkdir -p "$(dirname "${output_path}")"
		printf '%s\n' "${output_path}"
		return
	fi

	mkdir -p "${output_path}"
	printf '%s\n' "${output_path%/}/nido-${sanitized_tag}.tar"
}

build_tar() {
	local image_tag="${1:-}"
	local output_path="${2:-}"
	local image_ref
	local archive_path

	if [[ -z "${image_tag}" || -z "${output_path}" ]]; then
		echo "build-tar requires a tag and output path" >&2
		exit 1
	fi

	ensure_command "${DOCKER_BIN}" "Docker"
	image_ref="${DOCKER_IMAGE_REPOSITORY}:${image_tag}"
	archive_path="$(resolve_archive_path "${output_path}" "${image_tag}")"

	log "Building ${image_ref} for ${DOCKER_PLATFORM}"
	(
		cd "${ROOT_DIR}"
		"${DOCKER_BIN}" buildx build --platform "${DOCKER_PLATFORM}" -t "${image_ref}" -f "${DOCKERFILE_PATH}" "${DOCKER_CONTEXT_PATH}" --load
	)

	log "Saving ${image_ref} to ${archive_path}"
	"${DOCKER_BIN}" save -o "${archive_path}" "${image_ref}"
	printf '%s\n' "${archive_path}"
}

command_name="${1:-}"
case "${command_name}" in
	build-tar)
		shift
		build_tar "$@"
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