#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $0 -t <target-path>"; exit 1; }

TARGET=""
while getopts ":t:" opt; do
  case $opt in
    t) TARGET="$OPTARG" ;;
    *) usage ;;
  esac
done

[[ -z "$TARGET" ]] && usage

if [[ ! -d "$TARGET" ]]; then
  echo "Target path does not exist: $TARGET" >&2
  exit 1
fi

SRC_DIR="$(cd "$(dirname "$0")/../templates/.github/workflows" && pwd)"
DST_DIR="$TARGET/.github/workflows"

mkdir -p "$DST_DIR"
cp -f "$SRC_DIR"/*.yml "$DST_DIR"/

echo "Copied workflows to $DST_DIR"