#!/usr/bin/env bash
# Deploy Edge Functions + secrets for Mati. Requires: supabase login + project access.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MATI_PROJECT_REF="${SUPABASE_PROJECT_REF:-chfarvaiabixaxcylhhr}"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local (need VAPID_* and PUSH_WEBHOOK_SECRET)"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env.local
set +a

for var in PUSH_WEBHOOK_SECRET VAPID_PRIVATE_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing $var in .env.local"
    exit 1
  fi
done

echo "Linking project ${MATI_PROJECT_REF}..."
npx supabase link --project-ref "$MATI_PROJECT_REF"

echo "Setting Edge secrets..."
npx supabase secrets set \
  "PUSH_WEBHOOK_SECRET=$PUSH_WEBHOOK_SECRET" \
  "VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY" \
  "VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY" \
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY"

echo "Deploying functions..."
npx supabase functions deploy push-send --no-verify-jwt
npx supabase functions deploy recipe-import-url

echo ""
echo "Done. Configure Database Webhook in Dashboard:"
echo "  Table: household_events | Insert"
echo "  URL: https://${MATI_PROJECT_REF}.supabase.co/functions/v1/push-send"
echo "  Header: x-push-secret = (same as PUSH_WEBHOOK_SECRET in .env.local)"
echo ""
echo "Or run: npm run db:types  (after link works)"
