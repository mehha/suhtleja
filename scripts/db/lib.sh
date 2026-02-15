#!/usr/bin/env bash

load_dotenv() {
  local env_file="${1:-.env}"

  if [[ ! -f "$env_file" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Trim CR from CRLF files
    line="${line%$'\r'}"

    # Skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

    # Optional "export " prefix
    line="${line#export }"

    # Keep only KEY=VALUE lines
    [[ "$line" == *"="* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"

    # Remove surrounding quotes if present
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:-1}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:-1}"
    fi

    export "$key=$value"
  done < "$env_file"
}
