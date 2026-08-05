import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertSafeRecipeUrl } from "./url-validation.ts";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

function extensionForContentType(contentType: string): string {
  const base = contentType.split(";")[0]!.trim().toLowerCase();
  if (base === "image/webp") return "webp";
  if (base === "image/png") return "png";
  if (base === "image/gif") return "gif";
  if (base === "image/heic" || base === "image/heif") return "heic";
  return "jpg";
}

/**
 * Download a remote recipe image and store it in the public `recipe-images` bucket.
 * Returns the public URL, or null if mirroring fails (caller should keep the original URL).
 */
export async function mirrorRecipeImage(
  supabase: SupabaseClient,
  userId: string,
  imageUrl: string
): Promise<string | null> {
  let url: URL;
  try {
    url = assertSafeRecipeUrl(imageUrl);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]!
      .trim()
      .toLowerCase();
    if (!contentType.startsWith("image/")) return null;

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;

    const ext = extensionForContentType(contentType);
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("recipe-images").upload(path, buf, {
      contentType,
      upsert: false,
    });
    if (error) return null;

    const {
      data: { publicUrl },
    } = supabase.storage.from("recipe-images").getPublicUrl(path);
    return publicUrl || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
