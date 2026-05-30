const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function assertSafeRecipeUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString.trim());
  } catch {
    throw new Error("Ogiltig URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Endast http- och https-länkar stöds");
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) {
    throw new Error("Den här adressen kan inte användas");
  }

  if (isPrivateIpv4(host)) {
    throw new Error("Den här adressen kan inte användas");
  }

  return url;
}
