"use client";

import { useLayoutEffect } from "react";

const LOCKED_VAR = "--mati-safe-bottom-locked";
const DEFAULT_BOTTOM_PX = 34;
const MAX_BOTTOM_PX = 40;

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
  const raw =
    root.style.getPropertyValue(LOCKED_VAR) ||
    getComputedStyle(root).getPropertyValue(LOCKED_VAR);
  return parseFloat(raw) || 0;
}

function computeSafeBottomPx(): number {
  const measured = measureSafeAreaBottom();
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const base = Math.round(measured > 0 ? measured : standalone ? DEFAULT_BOTTOM_PX : 0);
  return Math.min(base, MAX_BOTTOM_PX);
}

/** Lock bottom safe-area once per session; re-measure only on orientation change. */
function applyLockedSafeArea(mode: "initial" | "orientation") {
  const root = document.documentElement;
  const next = computeSafeBottomPx();
  const current = readLockedPx(root);

  if (mode === "initial" && current > 0) return;
  if (next <= 0 && current > 0) return;

  root.style.setProperty(LOCKED_VAR, `${next}px`);
}

export function useLockedSafeArea() {
  useLayoutEffect(() => {
    applyLockedSafeArea("initial");

    const onOrientation = () => {
      window.setTimeout(() => applyLockedSafeArea("orientation"), 100);
    };
    window.addEventListener("orientationchange", onOrientation);

    return () => {
      window.removeEventListener("orientationchange", onOrientation);
    };
  }, []);
}

export const useStableBottomChrome = useLockedSafeArea;
