#!/usr/bin/env bash
# Install the pinned Graphify CLI and register its official Pi skill.
# MCP and the native guard stay commented out. See docs/graphify.md.
# This script is not an npm postinstall hook.

set -euo pipefail

root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
pin="${root}/pins/graphifyy"

if [[ ! -f "${pin}" ]]; then
  echo "error: pin file not found: ${pin}" >&2
  exit 1
fi

spec=""
while IFS= read -r line || [[ -n "${line}" ]]; do
  case "${line}" in
    "" | \#*)
      continue
      ;;
    *)
      if [[ -n "${spec}" ]]; then
        echo "error: ${pin} must contain one graphifyy==X.Y.Z requirement." >&2
        exit 1
      fi
      spec="${line}"
      ;;
  esac
done < "${pin}"

if [[ ! "${spec}" =~ ^graphifyy==[0-9]+\.[0-9]+\.[0-9]+([.a-zA-Z0-9_+-]+)?$ ]]; then
  echo "error: ${pin} must contain one graphifyy==X.Y.Z requirement." >&2
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "error: uv is not on PATH. Install uv from https://docs.astral.sh/uv/ and re-run scripts/bootstrap-graphify.sh." >&2
  exit 1
fi

# Plain pin. Re-running uv tool install with the same requirement succeeds.
# Optional MCP extra (not installed by default). To opt in, replace the
# command below with the commented line, using the version from pins/graphifyy:
# uv tool install "graphifyy[mcp]==X.Y.Z"
echo "installing ${spec}"
uv tool install "${spec}"

if ! command -v graphify >/dev/null 2>&1; then
  bin_dir="$(uv tool dir --bin 2>/dev/null || true)"
  if [[ -n "${bin_dir}" && -x "${bin_dir}/graphify" ]]; then
    PATH="${bin_dir}:${PATH}"
    export PATH
  fi
fi

if ! command -v graphify >/dev/null 2>&1; then
  echo "error: graphify is not on PATH after installing ${spec}. Run 'uv tool update-shell', open a new shell, and re-run scripts/bootstrap-graphify.sh." >&2
  exit 1
fi

echo "registering the Pi skill"
graphify install --platform pi

# Optional native guard (not installed by default). Graphify registers its own
# Pi extension; this repository does not ship a second guard.
# graphify pi guard install

echo "graphify Pi skill registered (${spec})"
