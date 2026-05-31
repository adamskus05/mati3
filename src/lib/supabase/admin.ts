import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — server-only, never expose to the browser.
 * Uses loose typing so new tables work before `npm run db:types` is re-run.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
