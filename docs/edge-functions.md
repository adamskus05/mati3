# Supabase Edge Functions

## Functions

| Function | Purpose | JWT |
|----------|---------|-----|
| `push-send` | Web push (database webhook) | No (`--no-verify-jwt`) |
| `recipe-import-url` | Import recipe from URL | Yes (user Bearer token) |
| `recipe-import-image` | Import recipe from photo (OpenAI vision) | Yes (user Bearer token) |

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
  NEXT_PUBLIC_VAPID_PUBLIC_KEY="..." \
  OPENAI_API_KEY="..."   # required for photo import
npx supabase functions deploy push-send --no-verify-jwt
npx supabase functions deploy recipe-import-url
npx supabase functions deploy recipe-import-image
```

## Recipe import in app

`RecipeEditor` calls:

- `recipe-import-url` for links (JSON-LD scrape)
- `recipe-import-image` for camera/file photos (OpenAI `gpt-4o`)

Photos upload to the public Storage bucket `recipe-images` (migration `20250529120300_recipe_images_bucket.sql`). URL import also mirrors the page image into that bucket when possible. Set Edge secret `OPENAI_API_KEY` and run the storage migration before photo import works.

Vercel only needs `NEXT_PUBLIC_SUPABASE_URL` and anon key for client invokes.

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

See **[push-verification.md](./push-verification.md)** for curl tests, SQL checks, and the end-to-end checklist (two users, webhook, expected `sent` count).

## Types after migrations

```bash
npm run db:types
```

Requires linked project (`npx supabase link`).

## Storage (recipe photos)

Apply migration `20250529120300_recipe_images_bucket.sql` (bucket `recipe-images`, public read, auth upload under `{user_id}/`).
