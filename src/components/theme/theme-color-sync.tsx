"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useMatiTheme } from "@/hooks/use-mati-theme";
import { getStatusBarColor } from "@/lib/theme-status-colors";
import { isMatiThemeId } from "@/lib/themes";

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Synkar theme-color och iOS status bar med appens ljust/mörkt läge + färgtema.
 * (Inte bara systemets prefers-color-scheme.)
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  const { themeId, ready } = useMatiTheme();

  useEffect(() => {
    if (!ready || !resolvedTheme) return;

    const stored = localStorage.getItem("mati:colorTheme");
    const id =
      stored && isMatiThemeId(stored) ? stored : themeId;
    const isDark = resolvedTheme === "dark";
    const color = getStatusBarColor(id, isDark);

    setMeta("theme-color", color);
    setMeta(
      "apple-mobile-web-app-status-bar-style",
      isDark ? "black-translucent" : "default"
    );
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [resolvedTheme, themeId, ready]);

  return null;
}
