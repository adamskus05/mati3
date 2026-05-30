"use client";

import { useLayoutEffect } from "react";

const LOCKED_VAR = "--mati-safe-bottom-locked";
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

/** Lock bottom safe-area once so iOS PWA nav height does not jump on navigation. */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.style.getPropertyValue(LOCKED_VAR)) return;

    const apply = () => {
      if (root.style.getPropertyValue(LOCKED_VAR)) return;
      const measured = measureSafeAreaBottom();
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const locked = Math.round(
        measured > 0 ? measured : standalone ? DEFAULT_BOTTOM_PX : 0
      );
      root.style.setProperty(LOCKED_VAR, `${locked}px`);
    };

    apply();
    const t = window.setTimeout(apply, 100);
    return () => window.clearTimeout(t);
  }, []);
}
