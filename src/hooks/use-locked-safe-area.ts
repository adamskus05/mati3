"use client";

import { useLayoutEffect } from "react";
import {
  applyAppChromeMetrics,
  applySafeBottomLock,
  applyVisualViewportHeight,
  readAppliedSafeBottomPx,
  resolveSafeBottomPx,
} from "@/lib/pwa/safe-area-bottom";

/** Lock visible viewport height + safe-area inset for stable bottom nav (iOS PWA). */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const locked = resolveSafeBottomPx();

    const sync = () => {
      applyVisualViewportHeight();
      if (readAppliedSafeBottomPx() !== locked) {
        applySafeBottomLock(locked);
      }
    };

    applyAppChromeMetrics();
    requestAnimationFrame(sync);
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 300);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("pageshow", sync);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
