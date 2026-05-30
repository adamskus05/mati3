import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseRecipeFromHtml } from "@/lib/recipes/parse-recipe-url";
import { assertSafeRecipeUrl } from "@/lib/recipes/url-validation";

const bodySchema = z.object({
  url: z.string().min(8).max(2048),
});

const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltig URL" }, { status: 400 });
  }

  let url: URL;
  try {
    url = assertSafeRecipeUrl(parsed.data.url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ogiltig URL" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MatiRecipeBot/1.0; +https://mati.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Kunde inte hämta sidan (${res.status})` },
        { status: 422 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return NextResponse.json(
        { error: "Länken pekar inte på en vanlig webbsida" },
        { status: 422 }
      );
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { error: "Kunde inte läsa sidan" },
        { status: 422 }
      );
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        return NextResponse.json(
          { error: "Sidan är för stor att tolka" },
          { status: 422 }
        );
      }
      chunks.push(value);
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      concatenateUint8(chunks)
    );

    const recipe = parseRecipeFromHtml(html, url.toString());
    if (!recipe) {
      return NextResponse.json(
        {
          error:
            "Kunde inte hitta receptdata på sidan. Fyll i ingredienser och instruktioner manuellt.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ...recipe,
      sourceUrl: url.toString(),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json(
        { error: "Tidsgräns – sidan svarade inte i tid" },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Kunde inte hämta recept från länken" },
      { status: 422 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

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
