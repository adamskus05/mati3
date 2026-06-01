"use client";

import { useLayoutEffect } from "react";
import {
  applyAppChromeMetrics,
  applyLockedAppHeight,
  applySafeBottomLock,
  readAppliedSafeBottomPx,
  resolveSafeBottomPx,
} from "@/lib/pwa/safe-area-bottom";

/** Lock shell height + safe-area inset for stable bottom nav (iOS PWA; keyboard must not resize chrome). */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const lockedBottom = resolveSafeBottomPx();

    const sync = () => {
      applyLockedAppHeight();
      if (readAppliedSafeBottomPx() !== lockedBottom) {
        applySafeBottomLock(lockedBottom);
      }
    };

    applyAppChromeMetrics();
    requestAnimationFrame(sync);
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 300);

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("pageshow", sync);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
