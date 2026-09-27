#!/usr/bin/env bash
# Build the plugin and copy it into the local test vault.
# Usage: ./scripts/install-to-test-vault.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT_PLUGIN_DIR="/mnt/c/Users/Lucio/projects/base-board-test/.obsidian/plugins/kanbase"

cd "$REPO_DIR"

echo "Building plugin..."
npm run build

mkdir -p "$VAULT_PLUGIN_DIR"

echo "Installing to $VAULT_PLUGIN_DIR"
# data.json is intentionally left untouched to preserve the vault's settings.
cp main.js manifest.json styles.css "$VAULT_PLUGIN_DIR/"

echo "Done."
