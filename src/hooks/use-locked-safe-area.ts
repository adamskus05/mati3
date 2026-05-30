"use client";

import { useLayoutEffect } from "react";

const LOCKED_VAR = "--mati-safe-bottom-locked";
const VIEWPORT_GAP_VAR = "--mati-viewport-bottom-gap";
const DEFAULT_BOTTOM_PX = 34;

function measureSafeAreaBottom(): number {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;";
  document.body.appendChild(el);
  const px = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  document.body.removeChild(el);
  return px;
}

function readLockedPx(root: HTMLElement): number {
  const raw = root.style.getPropertyValue(LOCKED_VAR);
  return parseFloat(raw) || 0;
}

/** Lock bottom safe-area (max during session) + visualViewport offset for stable PWA nav. */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let lockedPx = readLockedPx(root);

    const applyLocked = () => {
      const measured = measureSafeAreaBottom();
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const next = Math.round(
        measured > 0 ? measured : standalone ? DEFAULT_BOTTOM_PX : 0
      );
      lockedPx = Math.max(lockedPx, next);
      root.style.setProperty(LOCKED_VAR, `${lockedPx}px`);
    };

    const applyViewportGap = () => {
      const vv = window.visualViewport;
      if (!vv) {
        root.style.setProperty(VIEWPORT_GAP_VAR, "0px");
        return;
      }
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty(VIEWPORT_GAP_VAR, `${Math.round(gap)}px`);
    };

    const sync = () => {
      applyLocked();
      applyViewportGap();
    };

    sync();
    const t = window.setTimeout(sync, 100);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", applyViewportGap);
    vv?.addEventListener("scroll", applyViewportGap);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.clearTimeout(t);
      vv?.removeEventListener("resize", applyViewportGap);
      vv?.removeEventListener("scroll", applyViewportGap);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
}

/** @deprecated Use useLockedSafeArea – same hook. */
export const useStableBottomChrome = useLockedSafeArea;
