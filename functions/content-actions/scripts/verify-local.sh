#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${CONTENT_ACTIONS_BASE_URL:-http://localhost:3000}"
POST_ID="${1:-}"

print_json() {
  if command -v jq >/dev/null 2>&1; then
    jq
  else
    cat
  fi
}

echo "== healthcheck =="
curl -fsS "$BASE_URL/" | print_json

if [[ -z "$POST_ID" ]]; then
  echo
  echo "Skip like/unlike verification because POST_ID is empty."
  echo "Usage: bash functions/content-actions/scripts/verify-local.sh <post_id>"
  exit 0
fi

echo
echo "== like =="
curl -fsS -X POST "$BASE_URL/" \
  -H 'content-type: application/json' \
  -d "{\"action\":\"post.like\",\"postId\":\"$POST_ID\"}" | print_json

echo
echo "== unlike =="
curl -fsS -X POST "$BASE_URL/" \
  -H 'content-type: application/json' \
  -d "{\"action\":\"post.unlike\",\"postId\":\"$POST_ID\"}" | print_json
