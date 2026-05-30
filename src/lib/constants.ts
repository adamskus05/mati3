export const LAST_HOUSEHOLD_KEY = "mati:lastHouseholdId";
export const LAST_CATEGORY_KEY = (householdId: string) =>
  `mati:lastCategory:${householdId}`;

export type ListSortMode = "manual" | "updated" | "name";

export const LIST_SORT_STORAGE_KEY = (householdId: string) =>
  `mati:listSort:${householdId}`;

export const UNITS = [
  "st",
  "kg",
  "g",
  "l",
  "dl",
  "ml",
  "paket",
  "förp",
] as const;

export const CATEGORY_COLORS = [
  "#6B9B7A",
  "#8BAA6B",
  "#C4A35A",
  "#D4846A",
  "#7BA3C9",
  "#9B7BB8",
  "#E8A87C",
  "#6B8E9B",
] as const;

export const QUERY_KEYS = {
  households: ["households"] as const,
  household: (id: string) => ["household", id] as const,
  members: (id: string) => ["members", id] as const,
  categories: (id: string) => ["categories", id] as const,
  lists: (id: string) => ["lists", id] as const,
  listHistory: (id: string) => ["listHistory", id] as const,
  list: (id: string) => ["list", id] as const,
  items: (listId: string) => ["items", listId] as const,
  presets: (id: string) => ["presets", id] as const,
  recipes: (id: string) => ["recipes", id] as const,
  recipe: (id: string) => ["recipe", id] as const,
  profile: ["profile"] as const,
  events: (id: string) => ["events", id] as const,
  myMembership: (householdId: string, userId: string) =>
    ["myMembership", householdId, userId] as const,
};

export const HOUSEHOLD_ROLES = {
  owner: "Ägare",
  member: "Medlem",
} as const;
