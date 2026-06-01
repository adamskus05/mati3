import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { parseRecipeFromHtml } from "../_shared/parse-recipe-url.ts";
import { assertSafeRecipeUrl } from "../_shared/url-validation.ts";

const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

function concatenateUint8(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Ej inloggad" }, 401);
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

  let json: { url?: string };
  try {
    json = await req.json();
  } catch {
    return jsonResponse({ error: "Ogiltig begäran" }, 400);
  }

  const urlRaw = typeof json.url === "string" ? json.url.trim() : "";
  if (urlRaw.length < 8 || urlRaw.length > 2048) {
    return jsonResponse({ error: "Ogiltig URL" }, 400);
  }

  let url: URL;
  try {
    url = assertSafeRecipeUrl(urlRaw);
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Ogiltig URL" },
      400
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return jsonResponse(
        { error: `Kunde inte hämta sidan (${res.status})` },
        422
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return jsonResponse(
        { error: "Länken pekar inte på en vanlig webbsida" },
        422
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return jsonResponse({ error: "Kunde inte läsa sidan" }, 422);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        return jsonResponse({ error: "Sidan är för stor att tolka" }, 422);
      }
      chunks.push(value);
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      concatenateUint8(chunks)
    );

    const recipe = parseRecipeFromHtml(html, url.toString());
    if (!recipe) {
      return jsonResponse(
        {
          error:
            "Kunde inte hitta receptdata på sidan. Fyll i ingredienser och instruktioner manuellt.",
        },
        422
      );
    }

    return jsonResponse({
      ...recipe,
      sourceUrl: url.toString(),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return jsonResponse(
        { error: "Tidsgräns – sidan svarade inte i tid" },
        422
      );
    }
    return jsonResponse(
      { error: "Kunde inte hämta recept från länken" },
      422
    );
  } finally {
    clearTimeout(timeout);
  }
});
