# Supabase Edge Functions

## Functions

| Function | Purpose | JWT |
|----------|---------|-----|
| `push-send` | Web push (database webhook) | No (`--no-verify-jwt`) |
| `recipe-import-url` | Import recipe from URL | Yes (user Bearer token) |

## One-command setup (local)

After CLI login and with `.env.local` filled in:

```bash
npx supabase login   # opens browser; token must be sbp_... (not service role JWT)
npm run setup:edge
```

Do **not** put `SUPABASE_ACCESS_TOKEN` in `.env.local` as the service role or anon JWT — that breaks `supabase secrets set`. The CLI uses the token from `supabase login` only.

This links project `chfarvaiabixaxcylhhr`, sets secrets from `.env.local`, and deploys both functions.

## Manual deploy

```bash
npx supabase link --project-ref chfarvaiabixaxcylhhr
npx supabase secrets set \
  PUSH_WEBHOOK_SECRET="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_PUBLIC_KEY="..." \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
npx supabase functions deploy push-send --no-verify-jwt
npx supabase functions deploy recipe-import-url
```

## Database webhook (push)

In [Supabase Dashboard](https://supabase.com/dashboard/project/chfarvaiabixaxcylhhr/database/hooks) → **Create a new hook**:

| Field | Value |
|-------|--------|
| Name | `household_events_push` |
| Table | `household_events` |
| Events | Insert |
| Type | HTTP Request |
| Method | POST |
| URL | `https://chfarvaiabixaxcylhhr.supabase.co/functions/v1/push-send` |
| HTTP Headers | `x-push-secret: <same as PUSH_WEBHOOK_SECRET in .env.local>` |
| Timeout | 5000 ms |

The Next route `/api/push/send` remains as a fallback proxy during migration.

## Types after migrations

```bash
npm run db:types
```

Requires linked project (`npx supabase link`).

## Recipe import in app

`RecipeEditor` calls `supabase.functions.invoke('recipe-import-url')` directly. Vercel only needs `NEXT_PUBLIC_SUPABASE_URL` and anon key.
