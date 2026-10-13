#!/usr/bin/env bash
# Regenerate src/components/design/DesignViews.{jsx,css} from the design markup.
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
python3 -I scripts/design/bind.py design/etherx-word.markup.html > "$tmp"
python3 -I scripts/design/regions.py "$tmp" > scripts/design/regions.json
python3 -I scripts/design/conv.py "$tmp" scripts/design/regions.json src/components/design DesignViews
