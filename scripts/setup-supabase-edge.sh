#!/usr/bin/env bash
# Deploy Edge Functions + secrets for Mati.
# Requires: npx supabase login  (CLI token sbp_..., NOT service role JWT)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MATI_PROJECT_REF="${SUPABASE_PROJECT_REF:-chfarvaiabixaxcylhhr}"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local (need VAPID_* and PUSH_WEBHOOK_SECRET)"
  exit 1
fi

# Read only app secrets — do NOT source .env.local (SUPABASE_* JWTs break the CLI).
read_env() {
  local key=$1
  grep -E "^${key}=" .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//'
}

PUSH_WEBHOOK_SECRET=$(read_env PUSH_WEBHOOK_SECRET)
VAPID_PRIVATE_KEY=$(read_env VAPID_PRIVATE_KEY)
VAPID_PUBLIC_KEY=$(read_env NEXT_PUBLIC_VAPID_PUBLIC_KEY)

if [[ -z "$PUSH_WEBHOOK_SECRET" || -z "$VAPID_PRIVATE_KEY" || -z "$VAPID_PUBLIC_KEY" ]]; then
  echo "Missing PUSH_WEBHOOK_SECRET, VAPID_PRIVATE_KEY, or NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local"
  exit 1
fi

# Supabase CLI uses sbp_ access token from 'supabase login', not keys from .env.local
unset SUPABASE_ACCESS_TOKEN 2>/dev/null || true

echo "Linking project ${MATI_PROJECT_REF}..."
npx supabase link --project-ref "$MATI_PROJECT_REF"

echo "Setting Edge secrets..."
npx supabase secrets set \
  "PUSH_WEBHOOK_SECRET=${PUSH_WEBHOOK_SECRET}" \
  "VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}" \
  "VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}" \
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}"

echo "Deploying functions..."
npx supabase functions deploy push-send --no-verify-jwt
npx supabase functions deploy recipe-import-url

echo ""
echo "Done. Configure Database Webhook in Dashboard:"
echo "  Table: household_events | Insert"
echo "  URL: https://${MATI_PROJECT_REF}.supabase.co/functions/v1/push-send"
echo "  Header: x-push-secret = (same as PUSH_WEBHOOK_SECRET in .env.local)"
echo ""
echo "Optional: npm run db:types"
