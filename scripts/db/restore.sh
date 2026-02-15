#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

source "$ROOT_DIR/scripts/db/lib.sh"

extract_db_from_uri() {
  local uri_no_query="${1%%\?*}"
  local after_protocol="${uri_no_query#*://}"
  local path_part="${after_protocol#*/}"

  if [[ "$path_part" == "$after_protocol" ]]; then
    echo ""
    return
  fi

  local db_name="${path_part%%/*}"
  echo "$db_name"
}

load_dotenv ".env"

if ! command -v mongorestore >/dev/null 2>&1; then
  echo "Error: mongorestore not found. Install MongoDB Database Tools first."
  exit 1
fi

LOCAL_URI="${LOCAL_MONGO_URI:-${DATABASE_URI:-}}"
if [[ -z "$LOCAL_URI" ]]; then
  echo "Error: LOCAL_MONGO_URI or DATABASE_URI is required."
  exit 1
fi

REMOTE_URI="${COOLIFY_MONGO_URI:-}"
REMOTE_DB="${REMOTE_MONGO_DB:-}"
LOCAL_DB="${LOCAL_MONGO_DB:-}"

if [[ -z "$REMOTE_DB" && -n "$REMOTE_URI" ]]; then
  REMOTE_DB="$(extract_db_from_uri "$REMOTE_URI")"
fi

if [[ -z "$LOCAL_DB" ]]; then
  LOCAL_DB="$(extract_db_from_uri "$LOCAL_URI")"
fi

BACKUP_DIR="${DB_BACKUP_DIR:-backups/db}"

if [[ $# -ge 1 ]]; then
  ARCHIVE_PATH="$1"
else
  ARCHIVE_PATH="$(ls -1t "$BACKUP_DIR"/*.archive.gz 2>/dev/null | head -n1 || true)"
fi

if [[ -z "${ARCHIVE_PATH:-}" || ! -f "$ARCHIVE_PATH" ]]; then
  echo "Error: archive not found. Pass a file path or run db:pull first."
  exit 1
fi

echo "Restoring archive into local MongoDB (with --drop)..."

RESTORE_ARGS=(
  --uri="$LOCAL_URI"
  --gzip
  --archive="$ARCHIVE_PATH"
  --drop
)

if [[ -n "$REMOTE_DB" ]]; then
  RESTORE_ARGS+=(--nsInclude="${REMOTE_DB}.*")
fi

if [[ -n "$REMOTE_DB" && -n "$LOCAL_DB" && "$REMOTE_DB" != "$LOCAL_DB" ]]; then
  echo "Remapping namespaces: ${REMOTE_DB}.* -> ${LOCAL_DB}.*"
  RESTORE_ARGS+=(--nsFrom="${REMOTE_DB}.*" --nsTo="${LOCAL_DB}.*")
fi

mongorestore "${RESTORE_ARGS[@]}"

echo "Restore completed from: $ARCHIVE_PATH"
