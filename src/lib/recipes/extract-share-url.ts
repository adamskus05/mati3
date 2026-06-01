const URL_IN_TEXT =
  /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

/** First http(s) URL from Web Share params (url, text, or title). */
export function extractShareUrl(
  urlParam: string | null,
  textParam: string | null,
  titleParam: string | null
): string | null {
  const candidates: string[] = [];
  if (urlParam?.trim()) candidates.push(urlParam.trim());
  if (textParam?.trim()) candidates.push(textParam.trim());
  if (titleParam?.trim()) candidates.push(titleParam.trim());

  for (const raw of candidates) {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        return new URL(trimmed).href;
      } catch {
        /* try regex below */
      }
    }
    const match = trimmed.match(URL_IN_TEXT);
    if (match?.[0]) {
      try {
        return new URL(match[0]).href;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/** Client-side safety check (mirrors edge url-validation rules). */
export function isAllowedShareUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local")
    ) {
      return false;
    }
    const parts = host.split(".").map(Number);
    if (parts.length === 4 && !parts.some(Number.isNaN)) {
      const [a, b] = parts;
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}
