#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

WRANGLER_CONFIG="${WRANGLER_CONFIG:-wrangler.jsonc}"
LOCAL_BINDING="${D1_LOCAL_BINDING:-D1}"
PERSIST_TO="${D1_LOCAL_PERSIST_TO:-.wrangler/state}"
LOCAL_D1_DIR="$PERSIST_TO/v3/d1"
BACKUP_DIR="${D1_BACKUP_DIR:-backups/d1}"
R2_LOCAL_BINDING="${R2_LOCAL_BINDING:-R2}"
R2_SYNC_CONCURRENCY="${R2_SYNC_CONCURRENCY:-8}"
SKIP_R2_SYNC="${SKIP_R2_SYNC:-0}"
TMP_DIR="$(mktemp -d)"
LOCAL_SQLITE_PATH=""
R2_SYNC_SUMMARY="skipped"

cleanup() {
  rm -rf "$TMP_DIR"
}

trap cleanup EXIT

extract_first_config_value() {
  local config_file="$1"
  local key="$2"

  if command -v rg >/dev/null 2>&1; then
    rg -oN "\"$key\"\\s*:\\s*\"[^\"]+\"" "$config_file" \
      | head -n1 \
      | sed -E "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/"
    return
  fi

  grep -oE "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$config_file" \
    | head -n1 \
    | sed -E "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\\1/"
}

# Copies the R2 objects referenced by the cloned database (media uploads and
# board TTS audio) from the remote bucket into Wrangler's local R2 state.
# The OpenNext incremental cache in the same bucket is intentionally skipped.
sync_r2_objects() {
  local bucket="$1"
  local keys_file="$TMP_DIR/r2-keys.txt"
  local downloaded_file="$TMP_DIR/r2-downloaded.txt"
  local download_dir="$TMP_DIR/r2"
  local total
  local downloaded

  mkdir -p "$download_dir"

  # Skip absolute keys and keys with '..' segments so downloads stay inside $download_dir.
  sqlite3 "$LOCAL_SQLITE_PATH" "
    SELECT COALESCE(NULLIF(_objectkey, ''), filename) FROM media WHERE filename IS NOT NULL
    UNION
    SELECT json_extract(entry.value, '\$.key')
    FROM boards, json_each(boards.tts_cache, '\$.entries') AS entry
    WHERE boards.tts_cache IS NOT NULL AND json_extract(entry.value, '\$.key') IS NOT NULL;
  " | grep -vE '^/|(^|/)\.\.(/|$)' > "$keys_file" || true

  total="$(wc -l < "$keys_file" | tr -d ' ')"

  if [[ "$total" -eq 0 ]]; then
    R2_SYNC_SUMMARY="no objects referenced"
    return
  fi

  echo "Downloading $total R2 object(s) from remote bucket '$bucket' ..."
  tr '\n' '\0' < "$keys_file" \
    | R2_BUCKET="$bucket" R2_DOWNLOAD_DIR="$download_dir" xargs -0 -n1 -P "$R2_SYNC_CONCURRENCY" bash -c '
        key="$1"
        dest="$R2_DOWNLOAD_DIR/$key"
        mkdir -p "$(dirname "$dest")"
        if pnpm -s exec wrangler r2 object get "$R2_BUCKET/$key" --remote --file "$dest" >/dev/null 2>&1; then
          printf "%s\n" "$key"
        else
          printf "Warning: could not download R2 object %s\n" "$key" >&2
        fi
      ' _ > "$downloaded_file"

  downloaded="$(wc -l < "$downloaded_file" | tr -d ' ')"

  if [[ "$downloaded" -eq 0 ]]; then
    R2_SYNC_SUMMARY="0 of $total objects downloaded"
    return
  fi

  echo "Writing $downloaded R2 object(s) into local binding '$R2_LOCAL_BINDING' ..."
  node scripts/db/put-local-r2.mjs "$WRANGLER_CONFIG" "$PERSIST_TO" "$R2_LOCAL_BINDING" "$download_dir" "$downloaded_file"

  R2_SYNC_SUMMARY="$downloaded of $total objects from '$bucket'"
}

if [[ ! -f "$WRANGLER_CONFIG" ]]; then
  echo "Error: Wrangler config not found at $WRANGLER_CONFIG."
  exit 1
fi

REMOTE_DB_NAME="${1:-${D1_REMOTE_DB_NAME:-$(extract_first_config_value "$WRANGLER_CONFIG" database_name)}}"
R2_REMOTE_BUCKET="${R2_REMOTE_BUCKET:-$(extract_first_config_value "$WRANGLER_CONFIG" bucket_name)}"

if [[ -z "$REMOTE_DB_NAME" ]]; then
  echo "Error: Could not determine D1 database name from $WRANGLER_CONFIG."
  echo "Pass it explicitly: bash scripts/db/clone-d1-remote-to-local.sh <database-name>"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Error: sqlite3 is required for local D1 data import."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%F-%H%M%S)"
EXPORT_PATH="${2:-$BACKUP_DIR/${REMOTE_DB_NAME}-${STAMP}.sql}"
IMPORT_PATH="$TMP_DIR/import.sql"

echo "Exporting remote D1 database '$REMOTE_DB_NAME' to $EXPORT_PATH ..."
pnpm wrangler d1 export "$REMOTE_DB_NAME" --remote --output "$EXPORT_PATH"

{
  printf 'PRAGMA foreign_keys=OFF;\nBEGIN;\n'
  cat "$EXPORT_PATH"
  printf '\nCOMMIT;\nPRAGMA foreign_keys=ON;\n'
} > "$IMPORT_PATH"

echo "Resetting local D1 state in $LOCAL_D1_DIR ..."
rm -rf "$LOCAL_D1_DIR"

echo "Initializing local D1 binding '$LOCAL_BINDING' ..."
pnpm wrangler d1 execute "$LOCAL_BINDING" --local --persist-to="$PERSIST_TO" --command "SELECT 1;"

LOCAL_SQLITE_PATH="$(find "$LOCAL_D1_DIR" -type f -name '*.sqlite' ! -name 'metadata.sqlite' | head -n1 || true)"

if [[ -z "$LOCAL_SQLITE_PATH" ]]; then
  echo "Error: Could not locate local D1 sqlite file under $LOCAL_D1_DIR."
  exit 1
fi

echo "Importing full export into local sqlite database '$LOCAL_SQLITE_PATH' ..."
sqlite3 "$LOCAL_SQLITE_PATH" < "$IMPORT_PATH"

if [[ "$SKIP_R2_SYNC" == "1" ]]; then
  echo "Skipping R2 sync (SKIP_R2_SYNC=1)."
elif [[ -z "$R2_REMOTE_BUCKET" ]]; then
  echo "Warning: Could not determine R2 bucket name from $WRANGLER_CONFIG; skipping R2 sync."
  echo "Set R2_REMOTE_BUCKET=<bucket-name> to sync media."
else
  sync_r2_objects "$R2_REMOTE_BUCKET"
fi

cat <<EOF
Done.

- Remote export: $EXPORT_PATH
- Local binding: $LOCAL_BINDING
- Local persist dir: $PERSIST_TO
- Local sqlite file: $LOCAL_SQLITE_PATH
- R2 objects: $R2_SYNC_SUMMARY

Note: this only affects Wrangler's local D1 state. If your D1 bindings in $WRANGLER_CONFIG
still use "remote": true, local app sessions will continue to talk to remote D1 until you disable that.
EOF
