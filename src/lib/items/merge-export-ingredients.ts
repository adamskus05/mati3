import type { ExportIngredientRow } from "@/lib/recipes/scale-ingredients";

export type ExistingListItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  category_id: string | null;
  completed: boolean;
  sort_order: number;
};

export type ExportMergeUpdate = {
  id: string;
  quantity: number | null;
  notes: string | null;
};

export type ExportMergePlan = {
  updates: ExportMergeUpdate[];
  inserts: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
    category_id: null;
    completed: false;
    sort_order: number;
  }>;
  merged: number;
  added: number;
};

/** Simple Swedish adjective plural → base (gula → gul). Imperfect for all words. */
function normalizeAdjective(word: string): string {
  const w = word.toLowerCase();
  if (w.length > 3 && w.endsWith("a") && !w.endsWith("ska") && !w.endsWith("ska")) {
    return w.slice(0, -1);
  }
  return w;
}

/** Heuristic noun singularization (lökar → lök, tomater → tomat). */
function singularizeNoun(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 4) return w;
  if (w.endsWith("ar") || w.endsWith("or") || w.endsWith("er")) {
    return w.slice(0, -2);
  }
  return w;
}

/**
 * Normalized key for matching export lines to list items.
 * v1: lowercase, adjective + noun stems — not a full Swedish morphology engine.
 */
export function normalizeIngredientKey(name: string): string {
  const parts = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((part) => !/^\d+([.,]\d+)?$/.test(part));

  if (parts.length === 0) return "";

  const normalized = parts.map((part, i) => {
    if (i < parts.length - 1) return normalizeAdjective(part);
    return singularizeNoun(part);
  });

  return normalized.join(" ");
}

export function canMergeUnits(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const ua = a?.trim().toLowerCase() ?? "";
  const ub = b?.trim().toLowerCase() ?? "";
  if (!ua && !ub) return true;
  return ua === ub;
}

export function mergeQuantities(
  existing: number | null,
  incoming: number | null
): number | null {
  if (existing != null && incoming != null) {
    const sum = existing + incoming;
    return Math.round(sum * 100) / 100;
  }
  return existing ?? incoming;
}

export function mergeItemNotes(
  existing: string | null,
  incoming: string | null
): string | null {
  const a = existing?.trim() ?? "";
  const b = incoming?.trim() ?? "";
  if (!a) return b || null;
  if (!b || a === b) return a;
  if (a.includes(b)) return a;
  return `${a}; ${b}`;
}

export function planExportMerge(
  existingItems: ExistingListItem[],
  toExport: ExportIngredientRow[],
  nextSortOrder: (base: ExistingListItem[]) => number
): ExportMergePlan {
  const updates: ExportMergeUpdate[] = [];
  const inserts: ExportMergePlan["inserts"] = [];

  const keyToItem = new Map<string, ExistingListItem>();
  for (const item of existingItems) {
    const key = normalizeIngredientKey(item.name);
    if (key && !keyToItem.has(key)) {
      keyToItem.set(key, item);
    }
  }

  const virtualBase = [...existingItems];
  let merged = 0;
  let added = 0;

  for (const ing of toExport) {
    const name = ing.name.trim();
    if (!name) continue;

    const key = normalizeIngredientKey(name);
    const match = key ? keyToItem.get(key) : undefined;

    if (match && canMergeUnits(match.unit, ing.unit)) {
      const quantity = mergeQuantities(match.quantity, ing.quantity);
      const notes = mergeItemNotes(match.notes, ing.notes);
      updates.push({ id: match.id, quantity, notes });
      match.quantity = quantity;
      match.notes = notes;
      merged += 1;
      continue;
    }

    const sort_order = nextSortOrder(virtualBase);
    inserts.push({
      name,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes,
      category_id: null,
      completed: false,
      sort_order,
    });
    virtualBase.push({
      id: `new-${inserts.length}`,
      name,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes,
      category_id: null,
      completed: false,
      sort_order,
    });
    added += 1;
  }

  return { updates, inserts, merged, added };
}

export type ExportToListResult = {
  merged: number;
  added: number;
  total: number;
};
