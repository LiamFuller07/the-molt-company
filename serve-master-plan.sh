#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4132}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/plan-viewer"

echo "Serving Master Plan at: http://127.0.0.1:${PORT}/"
echo "Stop with Ctrl+C"
python3 -m http.server "$PORT" --bind 127.0.0.1
