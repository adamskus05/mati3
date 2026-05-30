/** iOS home-indicator inset for standalone PWA — fixed, never measured from env(). */
export const PWA_SAFE_BOTTOM_PX = 34;

const STORAGE_KEY = "mati:safe-bottom-px";
const CSS_VAR = "--mati-safe-bottom-locked";

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** One value per session; never grows/shrinks after first write. */
export function resolveSafeBottomPx(): number {
  if (typeof window === "undefined") {
    return isStandaloneDisplayMode() ? PWA_SAFE_BOTTOM_PX : 0;
  }

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored != null) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  } catch {
    /* private mode */
  }

  return isStandaloneDisplayMode() ? PWA_SAFE_BOTTOM_PX : 0;
}

export function applySafeBottomLock(px?: number): number {
  const value = px ?? resolveSafeBottomPx();
  const root = document.documentElement;
  root.style.setProperty(CSS_VAR, `${value}px`);

  try {
    sessionStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }

  return value;
}

export function readAppliedSafeBottomPx(): number {
  const root = document.documentElement;
  const raw =
    root.style.getPropertyValue(CSS_VAR) ||
    getComputedStyle(root).getPropertyValue(CSS_VAR);
  return parseFloat(raw) || 0;
}
