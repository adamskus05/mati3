import type { MatiThemeId } from "@/lib/themes";

/** Status bar / theme-color hex per färgtema (matchar globals.css). */
export const THEME_STATUS_COLORS: Record<
  MatiThemeId,
  { light: string; dark: string }
> = {
  sage: { light: "#F0F4EF", dark: "#1E2A22" },
  berry: { light: "#FBF4F5", dark: "#2A1C1F" },
  ocean: { light: "#EFF5F8", dark: "#1A242C" },
  sunset: { light: "#FBF6F0", dark: "#2A241C" },
  forest: { light: "#F0F3F0", dark: "#1A221E" },
  lavender: { light: "#F7F4FA", dark: "#242028" },
};

export function getStatusBarColor(
  themeId: MatiThemeId,
  isDark: boolean
): string {
  return THEME_STATUS_COLORS[themeId][isDark ? "dark" : "light"];
}
