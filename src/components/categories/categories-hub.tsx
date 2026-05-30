"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CategoriesView } from "@/components/categories/categories-view";
import { RecipeCategoriesView } from "@/components/recipe-categories/recipe-categories-view";
import type { Category, RecipeCategory } from "@/lib/database.types";

type Tab = "items" | "recipes";

export function CategoriesHub({
  householdId,
  initialItemCategories,
  initialRecipeCategories,
}: {
  householdId: string;
  initialItemCategories?: Category[];
  initialRecipeCategories?: RecipeCategory[];
}) {
  const [tab, setTab] = useState<Tab>("items");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">Kategorier</h1>
        <p className="text-xs text-muted-foreground">
          Hantera kategorier för inköpsvaror och recept
        </p>
      </div>

      <div
        className="flex rounded-xl border border-border/60 bg-muted/30 p-1"
        role="tablist"
        aria-label="Kategorityp"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "items"}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            tab === "items"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
          onClick={() => setTab("items")}
        >
          Inköpsvaror
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "recipes"}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            tab === "recipes"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
          onClick={() => setTab("recipes")}
        >
          Recept
        </button>
      </div>

      {tab === "items" ? (
        <CategoriesView
          householdId={householdId}
          initialCategories={initialItemCategories}
          embedded
        />
      ) : (
        <RecipeCategoriesView
          householdId={householdId}
          initialCategories={initialRecipeCategories}
        />
      )}
    </div>
  );
}
