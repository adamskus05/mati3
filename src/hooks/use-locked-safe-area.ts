"use client";

import { useLayoutEffect } from "react";

const LOCKED_VAR = "--mati-safe-bottom-locked";
const DEFAULT_BOTTOM_PX = 34;

function measureSafeAreaBottom(): number {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;bottom:0;left:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none;";
  document.documentElement.appendChild(el);
  const px = parseFloat(getComputedStyle(el).paddingBottom) || 0;
  document.documentElement.removeChild(el);
  return px;
}

function readLockedPx(root: HTMLElement): number {
  const raw = root.style.getPropertyValue(LOCKED_VAR);
  return parseFloat(raw) || 0;
}

function applyMaxLockedSafeArea(): void {
  const root = document.documentElement;
  const measured = measureSafeAreaBottom();
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const next = Math.round(
    measured > 0 ? measured : standalone ? DEFAULT_BOTTOM_PX : 0
  );
  const locked = Math.max(readLockedPx(root), next);
  root.style.setProperty(LOCKED_VAR, `${locked}px`);
}

/** Lock bottom safe-area to session max so iOS PWA nav height does not shrink on scroll. */
export function useLockedSafeArea() {
  useLayoutEffect(() => {
    applyMaxLockedSafeArea();
    const t = window.setTimeout(applyMaxLockedSafeArea, 150);

    const onOrientation = () => {
      window.setTimeout(applyMaxLockedSafeArea, 100);
    };
    window.addEventListener("orientationchange", onOrientation);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("orientationchange", onOrientation);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
