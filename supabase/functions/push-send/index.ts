import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { runPushSend } from "../_shared/push-send-core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const secret = req.headers.get("x-push-secret");
  const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret || !expected || secret !== expected) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  return runPushSend(raw);
});
