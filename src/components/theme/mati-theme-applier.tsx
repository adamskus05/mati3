"use client";

import { useEffect } from "react";
import { MATI_THEME_KEY, isMatiThemeId } from "@/lib/themes";

/** Applies saved color theme before paint (no flash). */
export function MatiThemeApplier() {
  useEffect(() => {
    const stored = localStorage.getItem(MATI_THEME_KEY);
    const id = stored && isMatiThemeId(stored) ? stored : "sage";
    document.documentElement.setAttribute("data-mati-theme", id);
  }, []);

  return null;
}
