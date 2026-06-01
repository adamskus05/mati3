/** Fallback when env() is 0 at first paint in standalone PWA. */
export const PWA_SAFE_BOTTOM_FALLBACK_PX = 20;

const STORAGE_KEY = "mati:safe-bottom-v4";
const CSS_VAR = "--mati-safe-bottom-locked";
const MIN_PX = 0;
const MAX_PX = 34;

const APP_HEIGHT_STORAGE_KEY = "mati:app-height-v1";
const APP_HEIGHT_VAR = "--mati-app-height";
const MIN_APP_HEIGHT_PX = 200;

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

/** Layout viewport height — stable when the virtual keyboard opens (with interactiveWidget: overlays-content). */
export function measureLayoutViewportHeightPx(): number {
  if (typeof window === "undefined") return 0;
  return Math.round(window.innerHeight);
}

/** First paint: layout viewport, or visual viewport if larger (iOS PWA initial frame). */
export function measureInitialAppHeightPx(): number {
  const inner = measureLayoutViewportHeightPx();
  const vv = Math.round(window.visualViewport?.height ?? 0);
  return computeLockedAppHeightPx(null, inner, vv);
}

/**
 * Shell height lock: initial max(inner, visual); only grows with layout — never shrinks for keyboard.
 */
export function computeLockedAppHeightPx(
  current: number | null,
  layoutInnerHeight: number,
  visualViewportHeight: number
): number {
  const inner = Math.round(layoutInnerHeight);
  const vv = Math.round(visualViewportHeight);
  const initial = Math.max(inner, vv > 0 ? vv : inner);

  if (current == null || current < MIN_APP_HEIGHT_PX) return initial;
  if (inner > current) return inner;
  return current;
}

export function readAppliedAppHeightPx(): number {
  if (typeof document === "undefined") return 0;
  const root = document.documentElement;
  const raw =
    root.style.getPropertyValue(APP_HEIGHT_VAR) ||
    getComputedStyle(root).getPropertyValue(APP_HEIGHT_VAR);
  return parseFloat(raw) || 0;
}

/** One locked shell height per session; never shrinks when the keyboard resizes visualViewport. */
export function resolveAppHeightPx(): number {
  if (typeof window === "undefined") return 0;

  try {
    const stored = sessionStorage.getItem(APP_HEIGHT_STORAGE_KEY);
    if (stored != null) {
      const n = parseInt(stored, 10);
      if (!Number.isNaN(n) && n >= MIN_APP_HEIGHT_PX) return n;
    }
  } catch {
    /* private mode */
  }

  return measureInitialAppHeightPx();
}

/**
 * Lock app shell height for stable header + bottom nav.
 * Only grows on orientation / window resize — not on keyboard visualViewport shrink.
 */
export function applyLockedAppHeight(px?: number): number {
  if (typeof window === "undefined") return 0;

  const stored = px ?? resolveAppHeightPx();
  const layout = measureLayoutViewportHeightPx();
  const vv = Math.round(window.visualViewport?.height ?? 0);
  const value = computeLockedAppHeightPx(
    stored >= MIN_APP_HEIGHT_PX ? stored : null,
    layout,
    vv
  );

  document.documentElement.style.setProperty(APP_HEIGHT_VAR, `${value}px`);

  try {
    sessionStorage.setItem(APP_HEIGHT_STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }

  return value;
}

/** @deprecated Use applyLockedAppHeight — kept for call sites during migration. */
export function applyVisualViewportHeight(): void {
  applyLockedAppHeight();
}

export function applyAppChromeMetrics(): number {
  applyLockedAppHeight();
  return applySafeBottomLock(resolveSafeBottomPx());
}

export function safeAreaBottomBootScript(): string {
  return `(function(){try{var r=document.documentElement,s=window.matchMedia('(display-mode: standalone)').matches,k='${STORAGE_KEY}',n=null;try{var st=sessionStorage.getItem(k);if(st!=null){var p=parseInt(st,10);if(!isNaN(p)&&p>=${MIN_PX}&&p<=${MAX_PX})n=p}}catch(e){}if(n===null){var d=document.createElement('div');d.style.cssText='position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';r.appendChild(d);var px=parseFloat(getComputedStyle(d).paddingBottom)||0;r.removeChild(d);var m=Math.round(px);n=s?(m>=12&&m<=${MAX_PX}?m:${PWA_SAFE_BOTTOM_FALLBACK_PX}):0}r.style.setProperty('${CSS_VAR}',n+'px');try{sessionStorage.setItem(k,String(n))}catch(e){}}catch(e){}})();`;
}

/** Runs before React paint — lock shell height; ignore keyboard visualViewport resizes. */
export function lockedAppHeightBootScript(): string {
  return `(function(){try{var k='${APP_HEIGHT_STORAGE_KEY}',min=${MIN_APP_HEIGHT_PX},h=null;function layout(){return Math.round(window.innerHeight)}function readStored(){try{var st=sessionStorage.getItem(k);if(st!=null){var p=parseInt(st,10);if(!isNaN(p)&&p>=min)return p}}catch(e){}return null}function sync(allowGrow){var inner=layout();if(h===null){h=readStored();if(h===null){var vv=Math.round((window.visualViewport&&window.visualViewport.height)||0);h=Math.max(inner,vv>0?vv:inner)}}if(allowGrow&&inner>h)h=inner;document.documentElement.style.setProperty('${APP_HEIGHT_VAR}',h+'px');try{sessionStorage.setItem(k,String(h))}catch(e){}}sync(false);window.addEventListener('orientationchange',function(){sync(true)});window.addEventListener('resize',function(){sync(true)})}catch(e){}})();`;
}

export function appChromeBootScript(): string {
  return `${safeAreaBottomBootScript()}${lockedAppHeightBootScript()}`;
}
