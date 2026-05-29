"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MATI_THEME_KEY,
  MATI_THEMES,
  type MatiThemeId,
  isMatiThemeId,
} from "@/lib/themes";

export function useMatiTheme() {
  const [themeId, setThemeIdState] = useState<MatiThemeId>("sage");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(MATI_THEME_KEY);
    if (stored && isMatiThemeId(stored)) {
      setThemeIdState(stored);
      document.documentElement.setAttribute("data-mati-theme", stored);
    } else {
      document.documentElement.setAttribute("data-mati-theme", "sage");
    }
    setReady(true);
  }, []);

  const setThemeId = useCallback((id: MatiThemeId) => {
    setThemeIdState(id);
    localStorage.setItem(MATI_THEME_KEY, id);
    document.documentElement.setAttribute("data-mati-theme", id);
  }, []);

  const current =
    MATI_THEMES.find((t) => t.id === themeId) ?? MATI_THEMES[0];

  return { themeId, setThemeId, themes: MATI_THEMES, current, ready };
}
