"use client";

import { useLayoutEffect } from "react";
import {
  applySafeBottomLock,
  readAppliedSafeBottomPx,
  resolveSafeBottomPx,
} from "@/lib/pwa/safe-area-bottom";

/** Lock safe-area inset for stable bottom nav padding in iOS PWA. */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const lockedBottom = resolveSafeBottomPx();

    const sync = () => {
      if (readAppliedSafeBottomPx() !== lockedBottom) {
        applySafeBottomLock(lockedBottom);
      }
    };

    applySafeBottomLock(lockedBottom);
    requestAnimationFrame(sync);
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 300);

    window.addEventListener("orientationchange", sync);
    window.addEventListener("pageshow", sync);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
