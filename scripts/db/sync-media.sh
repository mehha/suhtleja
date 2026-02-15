#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/db/lib.sh"
load_dotenv ".env"

if ! command -v rsync >/dev/null 2>&1; then
  echo "Error: rsync not found."
  exit 1
fi

REMOTE_HOST="${COOLIFY_SSH_HOST:-}"
REMOTE_MEDIA_PATH="${COOLIFY_MEDIA_PATH:-}"
LOCAL_MEDIA_PATH="${LOCAL_MEDIA_PATH:-public/media}"

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_MEDIA_PATH" ]]; then
  echo "Error: COOLIFY_SSH_HOST and COOLIFY_MEDIA_PATH are required."
  exit 1
fi

mkdir -p "$LOCAL_MEDIA_PATH"

RSYNC_ARGS=(-az --progress)
if [[ "${MEDIA_SYNC_DELETE:-0}" == "1" ]]; then
  RSYNC_ARGS+=(--delete)
fi

echo "Syncing media from $REMOTE_HOST:$REMOTE_MEDIA_PATH to $LOCAL_MEDIA_PATH..."
rsync "${RSYNC_ARGS[@]}" \
  "$REMOTE_HOST:$REMOTE_MEDIA_PATH/" \
  "$LOCAL_MEDIA_PATH/"

echo "Media sync completed."
