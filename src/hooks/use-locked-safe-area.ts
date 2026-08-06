"use client";

import { useLayoutEffect } from "react";
import { syncBottomChrome } from "@/lib/pwa/safe-area-bottom";

/**
 * Keep bottom nav glued to the visual viewport and re-measure safe-area
 * after iOS PWA cold-start (env() / layout viewport often settle late).
 */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    const sync = () => syncBottomChrome();

    sync();
    const raf = requestAnimationFrame(sync);
    const times = [50, 100, 250, 500, 1000, 2000].map((ms) =>
      window.setTimeout(sync, ms)
    );

    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("pageshow", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);

    return () => {
      cancelAnimationFrame(raf);
      for (const t of times) window.clearTimeout(t);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("pageshow", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
