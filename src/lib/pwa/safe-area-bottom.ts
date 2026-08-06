/** Safe-area + visualViewport helpers for stable iOS PWA bottom nav. */

const STORAGE_KEY = "mati:safe-bottom-v5";
const CSS_VAR_LOCK = "--mati-safe-bottom-locked";
const CSS_VAR_VV = "--mati-vv-bottom-offset";
const MIN_PX = 0;
const MAX_PX = 34;

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function measureEnvSafeBottomPx(): number {
  if (typeof document === "undefined") return 0;
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom, 0px);visibility:hidden;pointer-events:none;";
  document.documentElement.appendChild(el);
  const px = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  document.documentElement.removeChild(el);
  return px;
}

/**
 * Floor used only while env(safe-area-inset-bottom) still reads 0 on cold start.
 * Prefer 0 once env is available — avoids double-inset / floating nav.
 */
export function resolveSafeBottomFloorPx(): number {
  const standalone = isStandaloneDisplayMode();
  if (!standalone) return 0;

  const measured = Math.round(measureEnvSafeBottomPx());
  if (measured >= 8 && measured <= MAX_PX) return 0; // env works — no CSS floor needed
  if (measured > MAX_PX) return 0;

  // env still 0: tiny interim floor so icons aren't under the home indicator
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored != null) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= MIN_PX && n <= 20) return n;
    }
  } catch {
    /* private mode */
  }
  return 12;
}

export function applySafeBottomFloor(px?: number): number {
  const value = px ?? resolveSafeBottomFloorPx();
  document.documentElement.style.setProperty(CSS_VAR_LOCK, `${value}px`);
  try {
    sessionStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
  return value;
}

/**
 * Pin fixed bottom chrome to the *visual* viewport.
 * On iOS PWA cold start the layout viewport can leave a gap under fixed bottom:0;
 * swipe/resize settles it — we sync continuously instead.
 */
export function applyVisualViewportBottomOffset(): number {
  if (typeof window === "undefined") return 0;
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty(CSS_VAR_VV, "0px");
    return 0;
  }

  // Distance from visual viewport’s bottom to the layout viewport’s bottom
  const offset = Math.max(
    0,
    Math.round(window.innerHeight - vv.height - vv.offsetTop)
  );
  document.documentElement.style.setProperty(CSS_VAR_VV, `${offset}px`);
  return offset;
}

export function syncBottomChrome(): void {
  applySafeBottomFloor();
  applyVisualViewportBottomOffset();
}

export function readAppliedSafeBottomPx(): number {
  const raw =
    document.documentElement.style.getPropertyValue(CSS_VAR_LOCK) ||
    getComputedStyle(document.documentElement).getPropertyValue(CSS_VAR_LOCK);
  return parseFloat(raw) || 0;
}

/** Inline boot: minimal floor + clear stale v4 locks; vv offset starts at 0. */
export function safeAreaBottomBootScript(): string {
  return `(function(){try{var r=document.documentElement;r.style.setProperty('${CSS_VAR_VV}','0px');try{sessionStorage.removeItem('mati:safe-bottom-v4')}catch(e){}var s=window.matchMedia('(display-mode: standalone)').matches||(!!(navigator.standalone));var n=0;if(s){var d=document.createElement('div');d.style.cssText='position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';r.appendChild(d);var px=parseFloat(getComputedStyle(d).paddingBottom)||0;r.removeChild(d);n=(px>=8&&px<=${MAX_PX})?0:12}r.style.setProperty('${CSS_VAR_LOCK}',n+'px');try{sessionStorage.setItem('${STORAGE_KEY}',String(n))}catch(e){}}catch(e){}})();`;
}

export function appChromeBootScript(): string {
  return safeAreaBottomBootScript();
}

/** @deprecated use applySafeBottomFloor */
export function applySafeBottomLock(px?: number): number {
  return applySafeBottomFloor(px);
}

/** @deprecated use resolveSafeBottomFloorPx */
export function resolveSafeBottomPx(): number {
  return resolveSafeBottomFloorPx();
}
