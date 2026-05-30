"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchRecipes } from "@/lib/queries/recipes";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { QUERY_KEYS } from "@/lib/constants";
import type { RecipeCategory, RecipeWithCategory } from "@/lib/database.types";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  RecipeCategoryFilterBar,
  type RecipeCategoryFilter,
} from "@/components/recipes/recipe-category-filter";
import { useHouseholdRealtime } from "@/hooks/use-realtime";

function RecipesSkeleton() {
  return (
    <ul className="space-y-2 animate-pulse" aria-hidden>
      {[1, 2, 3].map((i) => (
        <li key={i} className="h-16 rounded-2xl bg-muted/60" />
      ))}
    </ul>
  );
}

export function RecipesView({
  householdId,
  initialRecipes,
  initialRecipeCategories,
}: {
  householdId: string;
  initialRecipes?: RecipeWithCategory[];
  initialRecipeCategories?: RecipeCategory[];
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<RecipeCategoryFilter>("all");

  useHouseholdRealtime(householdId);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.recipes(householdId),
    queryFn: () => fetchRecipes(createClient(), householdId),
    initialData: initialRecipes,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const { data: recipeCategories = [] } = useQuery({
    queryKey: QUERY_KEYS.recipeCategories(householdId),
    queryFn: () => fetchRecipeCategories(createClient(), householdId),
    initialData: initialRecipeCategories,
    staleTime: 60_000,
    refetchOnMount: initialRecipeCategories === undefined,
  });

  const filtered = useMemo(() => {
    let list = recipes;
    if (categoryFilter === "uncategorized") {
      list = list.filter((r) => !r.recipe_category_id);
    } else if (categoryFilter !== "all") {
      list = list.filter((r) => r.recipe_category_id === categoryFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, search, categoryFilter]);

  const pending = isLoading && recipes.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-[length:var(--mati-text-title)] font-semibold">
          Recept
        </h1>
        <Link
          href={`/h/${householdId}/recipes/new`}
          className="inline-flex h-9 items-center gap-1 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Nytt
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Sök recept…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-[var(--mati-touch)] rounded-xl pl-9"
        />
      </div>

      <RecipeCategoryFilterBar
        categories={recipeCategories}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />

      {pending ? (
        <RecipesSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            {search || categoryFilter !== "all"
              ? "Inga träffar"
              : "Inga recept ännu. Skapa ett eller importera från en länk."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((recipe) => (
            <li key={recipe.id}>
              <Link
                href={`/h/${householdId}/recipes/${recipe.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-3 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{recipe.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {recipe.recipe_category && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-foreground/90"
                        style={{
                          backgroundColor: `${recipe.recipe_category.color}33`,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: recipe.recipe_category.color }}
                          aria-hidden
                        />
                        {recipe.recipe_category.name}
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(recipe.updated_at).toLocaleDateString("sv-SE", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
