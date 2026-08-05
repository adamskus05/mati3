import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type IngredientOut = {
  name: string;
  quantity?: number;
  unit?: string;
  section?: string;
};

type ExtractedRecipe = {
  title: string;
  ingredients: IngredientOut[];
  instructions: string[];
};

const SYSTEM_PROMPT = `Du är en recepttolkare. Extrahera ett recept från bilden.
Svara ENDAST med giltig JSON (ingen markdown) i detta format:
{
  "title": "string",
  "ingredients": [{"name":"string","quantity":number|null,"unit":"string|null","section":"string|null"}],
  "instructions": ["string"]
}
Regler:
- Svenska om texten är svenska.
- quantity är tal (t.ex. 2 eller 0.5), annars null.
- unit är kort enhet (g, dl, msk, tsk, st, …) eller null.
- section är grupprubrik om det finns, annars null.
- instructions är en lista med rena steg utan nummerprefix.
- Om bilden inte är ett recept: {"title":"","ingredients":[],"instructions":[]}`;

function normalizeExtracted(raw: unknown): ExtractedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const ingredientsRaw = Array.isArray(o.ingredients) ? o.ingredients : [];
  const instructionsRaw = Array.isArray(o.instructions) ? o.instructions : [];

  const ingredients: IngredientOut[] = [];
  for (const item of ingredientsRaw) {
    if (!item || typeof item !== "object") continue;
    const ing = item as Record<string, unknown>;
    const name = typeof ing.name === "string" ? ing.name.trim() : "";
    if (!name) continue;
    const quantity =
      typeof ing.quantity === "number" && Number.isFinite(ing.quantity)
        ? ing.quantity
        : undefined;
    const unit =
      typeof ing.unit === "string" && ing.unit.trim()
        ? ing.unit.trim()
        : undefined;
    const section =
      typeof ing.section === "string" && ing.section.trim()
        ? ing.section.trim()
        : undefined;
    ingredients.push({ name, quantity, unit, section });
  }

  const instructions = instructionsRaw
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.replace(/^\d+[\.\):\-]\s*/, "").trim())
    .filter(Boolean);

  if (!title && ingredients.length === 0 && instructions.length === 0) {
    return null;
  }

  return {
    title: title || "Recept utan titel",
    ingredients,
    instructions,
  };
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Ogiltigt AI-svar");
  }
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

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    return jsonResponse(
      { error: "Fotoimport är inte konfigurerad (saknar OPENAI_API_KEY)" },
      503
    );
  }

  let json: {
    imageUrl?: string;
    imageBase64?: string;
    mimeType?: string;
  };
  try {
    json = await req.json();
  } catch {
    return jsonResponse({ error: "Ogiltig begäran" }, 400);
  }

  let imageUrl = typeof json.imageUrl === "string" ? json.imageUrl.trim() : "";
  const imageBase64 =
    typeof json.imageBase64 === "string" ? json.imageBase64.trim() : "";
  const mimeType =
    typeof json.mimeType === "string" && json.mimeType.startsWith("image/")
      ? json.mimeType
      : "image/jpeg";

  if (!imageUrl && imageBase64) {
    if (imageBase64.length > 4_000_000) {
      return jsonResponse({ error: "Bilden är för stor" }, 400);
    }
    imageUrl = `data:${mimeType};base64,${imageBase64}`;
  }

  if (!imageUrl || imageUrl.length < 12) {
    return jsonResponse({ error: "Saknar bild" }, 400);
  }

  if (
    !imageUrl.startsWith("data:image/") &&
    !imageUrl.startsWith("https://")
  ) {
    return jsonResponse({ error: "Ogiltig bild-URL" }, 400);
  }

  try {
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrahera receptet från den här bilden.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error("OpenAI error", aiRes.status, errText.slice(0, 500));
      return jsonResponse(
        { error: "Kunde inte tolka receptfoto just nu" },
        422
      );
    }

    const aiJson = (await aiRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = aiJson.choices?.[0]?.message?.content ?? "";
    const parsed = normalizeExtracted(extractJsonObject(content));
    if (!parsed || (parsed.ingredients.length === 0 && parsed.instructions.length === 0)) {
      return jsonResponse(
        {
          error:
            "Kunde inte hitta recept på bilden. Fyll i manuellt eller prova en tydligare bild.",
        },
        422
      );
    }

    return jsonResponse({
      title: parsed.title,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions,
      imageUrl: imageUrl.startsWith("https://") ? imageUrl : undefined,
      sourceUrl: null,
    });
  } catch (e) {
    console.error("recipe-import-image failed", e);
    return jsonResponse({ error: "Kunde inte tolka receptfoto" }, 422);
  }
});
