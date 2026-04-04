#!/usr/bin/env bash
# validate-release-config.sh
# Pre-build validation for Tauri updater release configuration.
# Run this before building release artifacts to catch misconfigurations early.

set -euo pipefail

TAURI_CONF="apps/desktop/src-tauri/tauri.conf.json"
CAPABILITIES="apps/desktop/src-tauri/capabilities/default.json"
errors=0
validated=()

echo "=== Validating release configuration ==="
echo ""

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
  echo "       Run scripts/substitute-release-config.sh or set TAURI_UPDATER_PUBKEY"
  errors=$((errors + 1))
else
  echo "  OK: pubkey is set"
  validated+=("pubkey")
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
    validated+=("signing-key")
  fi
fi

# 4. Check that the endpoint URL is valid (must be HTTPS, must end in latest.json)
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
elif [[ "$endpoint" == *" "* || "$endpoint" == *$'\t'* ]]; then
  echo "ERROR: endpoint URL contains whitespace"
  echo "       Current value: $endpoint"
  errors=$((errors + 1))
elif [[ "$endpoint" != https://* ]]; then
  echo "ERROR: endpoint URL must start with https://"
  echo "       Current value: $endpoint"
  errors=$((errors + 1))
elif [[ "$endpoint" != */latest.json ]]; then
  echo "ERROR: endpoint URL must end with /latest.json (not just contain it)"
  echo "       Current value: $endpoint"
  errors=$((errors + 1))
else
  echo "  OK: endpoint URL is valid ($endpoint)"
  validated+=("endpoint-url")
fi

# 5. Check that tauri.conf.json version matches the git tag being built
conf_version=$(python3 -c "
import json
with open('$TAURI_CONF') as f:
    conf = json.load(f)
print(conf.get('version', ''))
")

if [[ -n "${GITHUB_REF_NAME:-}" ]]; then
  # Strip leading 'v' from the tag for comparison
  tag_version="${GITHUB_REF_NAME#v}"
  if [[ "$conf_version" != "$tag_version" ]]; then
    echo "ERROR: tauri.conf.json version ($conf_version) does not match git tag ($GITHUB_REF_NAME -> $tag_version)"
    echo "       Update the version field in $TAURI_CONF to match the tag"
    errors=$((errors + 1))
  else
    echo "  OK: version matches git tag ($conf_version == $tag_version)"
    validated+=("version-tag")
  fi
else
  echo "  SKIP: No GITHUB_REF_NAME set, skipping version/tag comparison"
  echo "        (version in config: $conf_version)"
fi

# 6. Check that all required Tauri capabilities are present
if [[ ! -f "$CAPABILITIES" ]]; then
  echo "ERROR: $CAPABILITIES not found"
  errors=$((errors + 1))
else
  required_capabilities=(
    "core:default"
    "updater:default"
  )

  capabilities_json=$(python3 -c "
import json
with open('$CAPABILITIES') as f:
    conf = json.load(f)
import sys
for perm in conf.get('permissions', []):
    print(perm)
")

  for cap in "${required_capabilities[@]}"; do
    if echo "$capabilities_json" | grep -qxF "$cap"; then
      echo "  OK: capability '$cap' is present"
    else
      echo "ERROR: required capability '$cap' is missing from $CAPABILITIES"
      errors=$((errors + 1))
    fi
  done
  validated+=("capabilities")
fi

# Summary
echo ""
echo "=== Validation Summary ==="
if [[ ${#validated[@]} -gt 0 ]]; then
  echo "Passed: ${validated[*]}"
fi
echo ""
if [[ $errors -gt 0 ]]; then
  echo "FAILED: $errors validation error(s) found. Fix them before releasing."
  exit 1
else
  echo "All release configuration checks passed."
fi
