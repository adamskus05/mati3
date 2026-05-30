"use client";

import { useLayoutEffect } from "react";
import {
  applySafeBottomLock,
  readAppliedSafeBottomPx,
  resolveSafeBottomPx,
} from "@/lib/pwa/safe-area-bottom";

/** Keep bottom nav chrome pixel-stable for the whole session (iOS PWA / Safari). */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const locked = applySafeBottomLock(resolveSafeBottomPx());

    const restore = () => {
      if (readAppliedSafeBottomPx() !== locked) {
        applySafeBottomLock(locked);
      }
    };

    window.visualViewport?.addEventListener("resize", restore);
    window.visualViewport?.addEventListener("scroll", restore);

    return () => {
      window.visualViewport?.removeEventListener("resize", restore);
      window.visualViewport?.removeEventListener("scroll", restore);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
