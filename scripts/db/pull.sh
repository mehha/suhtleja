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

if ! command -v mongodump >/dev/null 2>&1; then
  echo "Error: mongodump not found. Install MongoDB Database Tools first."
  exit 1
fi

REMOTE_URI="${COOLIFY_MONGO_URI:-}"
if [[ -z "$REMOTE_URI" ]]; then
  echo "Error: COOLIFY_MONGO_URI is required."
  exit 1
fi

REMOTE_DB="${REMOTE_MONGO_DB:-$(extract_db_from_uri "$REMOTE_URI")}"

BACKUP_DIR="${DB_BACKUP_DIR:-backups/db}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%F-%H%M%S)"
ARCHIVE_PATH="${1:-$BACKUP_DIR/suhtleja-$STAMP.archive.gz}"

echo "Creating MongoDB dump from Coolify..."
if [[ -n "$REMOTE_DB" ]]; then
  echo "Dumping database: $REMOTE_DB"
  mongodump \
    --uri="$REMOTE_URI" \
    --db="$REMOTE_DB" \
    --gzip \
    --archive="$ARCHIVE_PATH"
else
  echo "No REMOTE_MONGO_DB detected. Dumping all databases from URI target."
  mongodump \
    --uri="$REMOTE_URI" \
    --gzip \
    --archive="$ARCHIVE_PATH"
fi

echo "Dump created: $ARCHIVE_PATH"
