/**
 * Extra padding below the tab bar. iOS standalone already insets the viewport;
 * adding env() again lifts the whole bar too high.
 */
export const TAB_BAR_INNER_BOTTOM_PX = 6;

const STORAGE_KEY = "mati:safe-bottom-v3";
const CSS_VAR = "--mati-safe-bottom-locked";

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Always 0 — safe area is handled inside the tab bar height only. */
export function resolveSafeBottomPx(): number {
  return 0;
}

export function applySafeBottomLock(px = 0): number {
  const root = document.documentElement;
  root.style.setProperty(CSS_VAR, "0px");

  try {
    sessionStorage.setItem(STORAGE_KEY, "0");
  } catch {
    /* ignore */
  }

  return px;
}

export function readAppliedSafeBottomPx(): number {
  const root = document.documentElement;
  const raw =
    root.style.getPropertyValue(CSS_VAR) ||
    getComputedStyle(root).getPropertyValue(CSS_VAR);
  return parseFloat(raw) || 0;
}

export function safeAreaBottomBootScript(): string {
  return `(function(){try{document.documentElement.style.setProperty('${CSS_VAR}','0px');try{sessionStorage.setItem('${STORAGE_KEY}','0')}catch(e){}}catch(e){}})();`;
}
