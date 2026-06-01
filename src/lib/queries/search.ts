import type { SupabaseClient } from "@supabase/supabase-js";

export type HouseholdSearchResult = {
  kind: "recipe" | "list" | "item" | "category" | "recipe_category";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const SEARCH_KINDS = new Set<HouseholdSearchResult["kind"]>([
  "recipe",
  "list",
  "item",
  "category",
  "recipe_category",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRpcRows(data: unknown): unknown[] {
  if (data == null) return [];
  if (typeof data === "string") {
    try {
      return parseRpcRows(JSON.parse(data));
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) return data;
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.kind === "string" && typeof obj.href === "string") {
      return [obj];
    }
    if (obj.row && typeof obj.row === "object") {
      return [obj.row];
    }
  }
  return [];
}

function normalizeSearchRow(raw: unknown): HouseholdSearchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const kind = row.kind;
  const id = row.id;
  const title = row.title;
  const href = row.href;

  if (typeof kind !== "string" || !SEARCH_KINDS.has(kind as HouseholdSearchResult["kind"])) {
    return null;
  }
  if (typeof id !== "string" || typeof title !== "string" || typeof href !== "string") {
    return null;
  }

  const trimmedId = id.trim();
  const trimmedHref = href.trim();
  if (!trimmedId || !trimmedHref.startsWith("/")) return null;
  if (kind !== "category" && kind !== "recipe_category" && !UUID_RE.test(trimmedId)) {
    return null;
  }

  const subtitle =
    row.subtitle == null
      ? null
      : typeof row.subtitle === "string"
        ? row.subtitle
        : String(row.subtitle);

  return {
    kind: kind as HouseholdSearchResult["kind"],
    id: trimmedId,
    title: title.trim(),
    subtitle,
    href: trimmedHref,
  };
}

export async function searchHousehold(
  supabase: SupabaseClient,
  householdId: string,
  query: string,
  limit = 24
): Promise<HouseholdSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase.rpc("search_household", {
    p_household_id: householdId,
    p_query: q,
    p_limit: limit,
  });

  if (error) throw error;

  return parseRpcRows(data)
    .map(normalizeSearchRow)
    .filter((row): row is HouseholdSearchResult => row !== null);
}
