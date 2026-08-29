#!/usr/bin/env bash
set -euo pipefail

INFISICAL_PROJECT_ID="3d84474e-8f57-4383-9288-13a062e84723"
INFISICAL_ENV="${INFISICAL_ENV:-prod}"

# ---- Auth ----
source /Users/Dagkan/.claude/.secrets.env
export INFISICAL_TOKEN=$(infisical login --method=universal-auth \
  --client-id="$INFISICAL_CLIENT_ID" \
  --client-secret="$INFISICAL_CLIENT_SECRET" \
  --domain="$INFISICAL_API_URL" \
  --plain --silent 2>/dev/null)

_get_secret() {
  infisical secrets get "$1" \
    --projectId="$INFISICAL_PROJECT_ID" \
    --env="$INFISICAL_ENV" \
    --domain="$INFISICAL_API_URL" \
    --token="$INFISICAL_TOKEN" \
    --plain --silent 2>/dev/null
}

_put_secret() {
  local name="$1" value="$2" config="$3"
  printf '%s' "$value" | npx wrangler secret put "$name" --config "$config"
}

echo "==> Deploying folio-oauth..."
npx wrangler deploy --config wrangler-oauth.toml

echo "==> Setting folio-oauth secrets from Infisical..."
_put_secret RAINDROP_CLIENT_SECRET "$(_get_secret RAINDROP_CLIENT_SECRET)" wrangler-oauth.toml
_put_secret SESSION_SECRET         "$(_get_secret SESSION_SECRET)"         wrangler-oauth.toml

echo "==> Deploying folio-sync..."
npx wrangler deploy --config wrangler-sync.toml

echo "==> Done."
