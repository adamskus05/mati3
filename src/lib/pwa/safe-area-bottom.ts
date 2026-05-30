/** Fallback when env() is 0 in standalone PWA at first paint (below the tab icons). */
export const PWA_SAFE_BOTTOM_FALLBACK_PX = 20;

const STORAGE_KEY = "mati:safe-bottom-v2";
const CSS_VAR = "--mati-safe-bottom-locked";
const MIN_PX = 0;
const MAX_PX = 40;

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function measureEnvSafeBottomPx(): number {
  if (typeof document === "undefined") return 0;
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;";
  document.documentElement.appendChild(el);
  const px = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  document.documentElement.removeChild(el);
  return px;
}

export function clampSafeBottomPx(px: number, standalone: boolean): number {
  if (!standalone) return 0;
  const rounded = Math.round(px);
  if (rounded >= 12 && rounded <= MAX_PX) return rounded;
  return PWA_SAFE_BOTTOM_FALLBACK_PX;
}

/** One value per session; stable after first resolve. */
export function resolveSafeBottomPx(): number {
  const standalone = isStandaloneDisplayMode();

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored != null) {
        const n = parseInt(stored, 10);
        if (!Number.isNaN(n) && n >= MIN_PX && n <= MAX_PX) return n;
      }
    } catch {
      /* private mode */
    }
  }

  return clampSafeBottomPx(measureEnvSafeBottomPx(), standalone);
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

/** Inline boot script (must stay in sync with clamp logic above). */
export function safeAreaBottomBootScript(): string {
  return `(function(){try{var r=document.documentElement,s=window.matchMedia('(display-mode: standalone)').matches,k='${STORAGE_KEY}',n=null;try{var st=sessionStorage.getItem(k);if(st!=null){var p=parseInt(st,10);if(!isNaN(p)&&p>=0&&p<=${MAX_PX})n=p}}catch(e){}if(n===null){var d=document.createElement('div');d.style.cssText='position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';r.appendChild(d);var px=parseFloat(getComputedStyle(d).paddingBottom)||0;r.removeChild(d);var m=Math.round(px);n=s?(m>=12&&m<=${MAX_PX}?m:${PWA_SAFE_BOTTOM_FALLBACK_PX}):0}r.style.setProperty('${CSS_VAR}',n+'px');try{sessionStorage.setItem(k,String(n))}catch(e){}}catch(e){}})();`;
}
