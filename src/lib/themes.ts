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
  preview: [string, string, string];
};

export const MATI_THEMES: MatiTheme[] = [
  {
    id: "sage",
    name: "Salvia",
    description: "Mild och naturlig",
    preview: ["#9CB396", "#6B9B7A", "#F5F2EB"],
  },
  {
    id: "berry",
    name: "Bär",
    description: "Varm och inbjudande",
    preview: ["#C97B84", "#9E4D5A", "#FBF4F5"],
  },
  {
    id: "ocean",
    name: "Hav",
    description: "Fräsch och lugn",
    preview: ["#6B9EB8", "#4A7A94", "#F2F7FA"],
  },
  {
    id: "sunset",
    name: "Solnedgång",
    description: "Mjuk och solig",
    preview: ["#D4A574", "#B87D4A", "#FBF6F0"],
  },
  {
    id: "forest",
    name: "Skog",
    description: "Djup och jordnära",
    preview: ["#5F8A6B", "#3D5C47", "#F2F5F2"],
  },
  {
    id: "lavender",
    name: "Lavendel",
    description: "Lätt och lugn",
    preview: ["#9B8BB4", "#7A6A96", "#F7F4FA"],
  },
];

export function isMatiThemeId(value: string): value is MatiThemeId {
  return MATI_THEMES.some((t) => t.id === value);
}
