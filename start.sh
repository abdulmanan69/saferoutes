#!/usr/bin/env bash
# SafeRoute one-click runner (Mac/Linux)
set -e
echo "=========================================="
echo "  SafeRoute - Smart Road Trip Planner"
echo "=========================================="

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed. Get it from https://nodejs.org (LTS)."
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "Installing dependencies (first run only)..."
    npm install
fi

echo
echo "Starting SafeRoute... press Ctrl+C to stop."
npm run dev
