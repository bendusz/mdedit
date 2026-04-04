#!/usr/bin/env bash
# validate-release-config.sh
# Pre-build validation for Tauri updater release configuration.
# Run this before building release artifacts to catch misconfigurations early.

set -euo pipefail

TAURI_CONF="apps/desktop/src-tauri/tauri.conf.json"
errors=0

echo "=== Validating release configuration ==="

# 1. Check that tauri.conf.json exists
if [[ ! -f "$TAURI_CONF" ]]; then
  echo "ERROR: $TAURI_CONF not found"
  exit 1
fi

# 2. Check that pubkey is not empty or placeholder
pubkey=$(python3 -c "
import json, sys
with open('$TAURI_CONF') as f:
    conf = json.load(f)
print(conf.get('plugins', {}).get('updater', {}).get('pubkey', ''))
")

if [[ -z "$pubkey" ]]; then
  echo "ERROR: plugins.updater.pubkey is empty in $TAURI_CONF"
  echo "       Generate keys with: pnpm tauri signer generate -w ~/.tauri/mdedit.key"
  errors=$((errors + 1))
elif [[ "$pubkey" == *"REPLACE"* || "$pubkey" == *"placeholder"* || "$pubkey" == *"PLACEHOLDER"* ]]; then
  echo "ERROR: plugins.updater.pubkey is still a placeholder value in $TAURI_CONF"
  echo "       Current value: $pubkey"
  echo "       Generate keys with: pnpm tauri signer generate -w ~/.tauri/mdedit.key"
  errors=$((errors + 1))
else
  echo "  OK: pubkey is set"
fi

# 3. Check that TAURI_SIGNING_PRIVATE_KEY is set and well-formed
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  echo "ERROR: TAURI_SIGNING_PRIVATE_KEY environment variable is not set"
  echo "       Set it as a GitHub Actions secret or export it locally"
  errors=$((errors + 1))
else
  # Check it is valid base64
  if ! echo "$TAURI_SIGNING_PRIVATE_KEY" | base64 --decode > /dev/null 2>&1; then
    echo "ERROR: TAURI_SIGNING_PRIVATE_KEY is not valid base64"
    echo "       Regenerate with: pnpm tauri signer generate -w ~/.tauri/mdedit.key"
    errors=$((errors + 1))
  # Check minimum plausible length (Tauri Ed25519 private keys are >50 base64 chars)
  elif [[ ${#TAURI_SIGNING_PRIVATE_KEY} -lt 50 ]]; then
    echo "ERROR: TAURI_SIGNING_PRIVATE_KEY is suspiciously short (${#TAURI_SIGNING_PRIVATE_KEY} chars)"
    echo "       Expected a full Ed25519 private key in base64 format"
    errors=$((errors + 1))
  else
    echo "  OK: TAURI_SIGNING_PRIVATE_KEY is set and appears well-formed"
  fi
fi

# 4. Check that the endpoint URL is valid
endpoint=$(python3 -c "
import json, sys
with open('$TAURI_CONF') as f:
    conf = json.load(f)
endpoints = conf.get('plugins', {}).get('updater', {}).get('endpoints', [])
print(endpoints[0] if endpoints else '')
")

if [[ -z "$endpoint" ]]; then
  echo "ERROR: plugins.updater.endpoints is empty in $TAURI_CONF"
  errors=$((errors + 1))
elif [[ "$endpoint" != https://* ]]; then
  echo "ERROR: endpoint URL does not start with https://"
  echo "       Current value: $endpoint"
  errors=$((errors + 1))
elif [[ "$endpoint" != *"latest.json"* ]]; then
  echo "ERROR: endpoint URL does not point to latest.json"
  echo "       Current value: $endpoint"
  errors=$((errors + 1))
else
  echo "  OK: endpoint URL is valid ($endpoint)"
fi

# Summary
echo ""
if [[ $errors -gt 0 ]]; then
  echo "FAILED: $errors validation error(s) found. Fix them before releasing."
  exit 1
else
  echo "All release configuration checks passed."
fi
