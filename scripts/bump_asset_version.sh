#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
INDEX_FILE="$REPO_ROOT/index.html"
VERSION="$(date -u +%Y%m%d%H%M%S)"

if [[ ! -f "$INDEX_FILE" ]]; then
  echo "No se encuentra index.html en $INDEX_FILE" >&2
  exit 1
fi

perl -0pi -e "s#href=\"css/style\\.css(?:\\?v=[^\"]*)?\"#href=\"css/style.css?v=$VERSION\"#g" "$INDEX_FILE"
perl -0pi -e "s#src=\"js/analytics\\.js(?:\\?v=[^\"]*)?\"#src=\"js/analytics.js?v=$VERSION\"#g" "$INDEX_FILE"
perl -0pi -e "s#src=\"js/main\\.js(?:\\?v=[^\"]*)?\"#src=\"js/main.js?v=$VERSION\"#g" "$INDEX_FILE"

echo "Assets versionados con v=$VERSION"
