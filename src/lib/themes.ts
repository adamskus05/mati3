export const MATI_THEME_KEY = "mati:colorTheme";

export type MatiThemeId =
  | "sage"
  | "berry"
  | "ocean"
  | "sunset"
  | "forest"
  | "lavender";

export type MatiTheme = {
  id: MatiThemeId;
  name: string;
  description: string;
  /** [accent, light background, dark background] for picker swatches */
  preview: [string, string, string];
};

export const MATI_THEMES: MatiTheme[] = [
  {
    id: "sage",
    name: "Salvia",
    description: "Mild och naturlig",
    preview: ["#6B9B7A", "#F0F4EF", "#1E2A22"],
  },
  {
    id: "berry",
    name: "Bär",
    description: "Varm och inbjudande",
    preview: ["#C97B84", "#FBF4F5", "#2A1C1F"],
  },
  {
    id: "ocean",
    name: "Hav",
    description: "Fräsch och lugn",
    preview: ["#5A9AB5", "#EFF5F8", "#1A242C"],
  },
  {
    id: "sunset",
    name: "Solnedgång",
    description: "Mjuk och solig",
    preview: ["#D4A574", "#FBF6F0", "#2A241C"],
  },
  {
    id: "forest",
    name: "Skog",
    description: "Djup och jordnära",
    preview: ["#5F8A6B", "#F0F3F0", "#1A221E"],
  },
  {
    id: "lavender",
    name: "Lavendel",
    description: "Lätt och lugn",
    preview: ["#9B8BB4", "#F7F4FA", "#242028"],
  },
];

export function isMatiThemeId(value: string): value is MatiThemeId {
  return MATI_THEMES.some((t) => t.id === value);
}
