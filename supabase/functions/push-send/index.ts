import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { runPushSend } from "../_shared/push-send-core.ts";

type DirectBody = {
  householdId?: string;
  eventType?: string;
  title?: string;
  body?: string;
  url?: string;
  excludeUserId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const secret = req.headers.get("x-push-secret");
  const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const webhookOk = Boolean(secret && expected && secret === expected);

  if (webhookOk) {
    return runPushSend(raw);
  }

  // Authenticated member notify (works without Database Webhook)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: "Ej inloggad" }, 401);
  }

  const body = raw as DirectBody;
  const householdId =
    typeof body.householdId === "string" ? body.householdId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "Mati";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const eventType =
    typeof body.eventType === "string" ? body.eventType : "list_items_added";

  if (!householdId || !text) {
    return jsonResponse({ error: "Missing fields" }, 400);
  }

  const { data: membership, error: memberError } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !membership) {
    return jsonResponse({ error: "Ej medlem i hushållet" }, 403);
  }

  return runPushSend({
    householdId,
    eventType,
    title: title || "Mati",
    body: text,
    url:
      typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : `/h/${householdId}`,
    excludeUserId: user.id,
  });
});
