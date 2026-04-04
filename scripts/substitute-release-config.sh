#!/usr/bin/env bash
# substitute-release-config.sh
# Substitutes the updater public key into tauri.conf.json from environment.
# Called by CI before building release artifacts.
#
# Required environment variable:
#   TAURI_UPDATER_PUBKEY — the Ed25519 public key for verifying updates
#
# Usage:
#   TAURI_UPDATER_PUBKEY="dW50cnVzdGVkIGNvbW1lbnQ..." bash scripts/substitute-release-config.sh

set -euo pipefail

TAURI_CONF="apps/desktop/src-tauri/tauri.conf.json"
PLACEHOLDER="REPLACE_WITH_REAL_PUBLIC_KEY_BEFORE_RELEASE"

echo "=== Substituting release configuration ==="

# 1. Validate that the env var is set
if [[ -z "${TAURI_UPDATER_PUBKEY:-}" ]]; then
  echo "ERROR: TAURI_UPDATER_PUBKEY environment variable is not set"
  echo "       Set it as a GitHub Actions secret"
  exit 1
fi

# 2. Validate the key format — Tauri Ed25519 pubkeys are base64-encoded and
#    typically 40+ characters. Reject obviously invalid values.
if [[ ${#TAURI_UPDATER_PUBKEY} -lt 30 ]]; then
  echo "ERROR: TAURI_UPDATER_PUBKEY is suspiciously short (${#TAURI_UPDATER_PUBKEY} chars)"
  echo "       Expected an Ed25519 public key in base64 format"
  exit 1
fi

if [[ "$TAURI_UPDATER_PUBKEY" == *"REPLACE"* || "$TAURI_UPDATER_PUBKEY" == *"PLACEHOLDER"* ]]; then
  echo "ERROR: TAURI_UPDATER_PUBKEY appears to be a placeholder value"
  echo "       Set it to the real public key"
  exit 1
fi

# Basic base64 character check (alphanumeric, +, /, =)
if ! echo "$TAURI_UPDATER_PUBKEY" | grep -qE '^[A-Za-z0-9+/=]+$'; then
  echo "ERROR: TAURI_UPDATER_PUBKEY contains invalid characters for base64"
  echo "       Expected an Ed25519 public key in base64 format"
  exit 1
fi

# 3. Check that tauri.conf.json exists
if [[ ! -f "$TAURI_CONF" ]]; then
  echo "ERROR: $TAURI_CONF not found"
  exit 1
fi

# 4. Check that the placeholder is present (otherwise substitution is a no-op)
if ! grep -q "$PLACEHOLDER" "$TAURI_CONF"; then
  echo "WARNING: Placeholder '$PLACEHOLDER' not found in $TAURI_CONF"
  echo "         The pubkey may have already been substituted or manually set."
  echo "         Skipping substitution."
  exit 0
fi

# 5. Perform the substitution using python3 to avoid sed quoting issues with
#    base64 characters
python3 -c "
import json

with open('$TAURI_CONF') as f:
    conf = json.load(f)

conf['plugins']['updater']['pubkey'] = '''${TAURI_UPDATER_PUBKEY}'''

with open('$TAURI_CONF', 'w') as f:
    json.dump(conf, f, indent=2)
    f.write('\n')
"

echo "  OK: Substituted updater pubkey into $TAURI_CONF"
echo "      Key prefix: ${TAURI_UPDATER_PUBKEY:0:20}..."

# 6. Verify the substitution worked
new_pubkey=$(python3 -c "
import json
with open('$TAURI_CONF') as f:
    conf = json.load(f)
print(conf.get('plugins', {}).get('updater', {}).get('pubkey', ''))
")

if [[ "$new_pubkey" == "$PLACEHOLDER" ]]; then
  echo "ERROR: Substitution failed — pubkey is still the placeholder"
  exit 1
fi

echo "  OK: Substitution verified"
echo ""
echo "=== Substitution complete ==="
