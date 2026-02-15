#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${DB_BACKUP_DIR:-backups/db}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%F-%H%M%S)"
ARCHIVE_PATH="$BACKUP_DIR/verba-$STAMP.archive.gz"

bash "$ROOT_DIR/scripts/db/pull.sh" "$ARCHIVE_PATH"
bash "$ROOT_DIR/scripts/db/restore.sh" "$ARCHIVE_PATH"

echo "Database refresh completed."
