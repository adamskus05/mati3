import {
  canMergeUnits,
  normalizeIngredientKey,
} from "@/lib/items/merge-export-ingredients";

export type ListItemForDuplicate = {
  id: string;
  name: string;
  unit: string | null;
  completed: boolean;
};

/** Best matching open (incomplete) item on the list, if any. */
export function findListDuplicate(
  items: ListItemForDuplicate[],
  name: string,
  unit?: string | null
): ListItemForDuplicate | null {
  const key = normalizeIngredientKey(name);
  if (!key) return null;

  const open = items.filter((i) => !i.completed);
  const matches = open.filter(
    (i) => normalizeIngredientKey(i.name) === key
  );
  if (matches.length === 0) return null;

  const withCompatibleUnit = matches.find((i) => canMergeUnits(i.unit, unit));
  return withCompatibleUnit ?? matches[0];
}
