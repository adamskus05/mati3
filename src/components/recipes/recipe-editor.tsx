"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createRecipe,
  instructionsFromJson,
  updateRecipe,
  type RecipeUpsertPayload,
} from "@/lib/queries/recipes";
import type { RecipeIngredientInput, RecipeWithIngredients } from "@/lib/database.types";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { QUERY_KEYS, UNITS } from "@/lib/constants";
import {
  formatInstructionSteps,
  groupIngredientsBySection,
  parseInstructionLines,
} from "@/lib/recipes/instruction-format";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type IngredientRow = RecipeIngredientInput & { key: string };

function emptyIngredient(section?: string | null): IngredientRow {
  return {
    key: crypto.randomUUID(),
    name: "",
    quantity: null,
    unit: null,
    notes: null,
    section: section ?? null,
  };
}

export function RecipeEditor({
  householdId,
  userId,
  recipe,
}: {
  householdId: string;
  userId: string;
  recipe?: RecipeWithIngredients;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnline();
  const isEdit = Boolean(recipe);

  const [title, setTitle] = useState(recipe?.title ?? "");
  const [recipeCategoryId, setRecipeCategoryId] = useState<string | null>(
    recipe?.recipe_category_id ?? null
  );
  const [sourceUrl, setSourceUrl] = useState(recipe?.source_url ?? "");
  const [imageUrl, setImageUrl] = useState(recipe?.image_url ?? "");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    recipe?.recipe_ingredients.length
      ? recipe.recipe_ingredients.map((i) => ({
          key: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          notes: i.notes,
          section: i.section,
        }))
      : [emptyIngredient()]
  );
  const [instructionsText, setInstructionsText] = useState(() =>
    recipe
      ? formatInstructionSteps(instructionsFromJson(recipe.instructions))
      : ""
  );
  const [saving, setSaving] = useState(false);

  const ingredientGroups = useMemo(
    () => groupIngredientsBySection(ingredients),
    [ingredients]
  );

  const { data: recipeCategories = [] } = useQuery({
    queryKey: QUERY_KEYS.recipeCategories(householdId),
    queryFn: () => fetchRecipeCategories(createClient(), householdId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!recipe) return;
    setTitle(recipe.title);
    setRecipeCategoryId(recipe.recipe_category_id ?? null);
    setSourceUrl(recipe.source_url ?? "");
    setImageUrl(recipe.image_url ?? "");
    setIngredients(
      recipe.recipe_ingredients.map((i) => ({
        key: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
        section: i.section,
      }))
    );
    setInstructionsText(
      formatInstructionSteps(instructionsFromJson(recipe.instructions))
    );
  }, [recipe]);

  function updateIngredient(key: string, patch: Partial<IngredientRow>) {
    setIngredients((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function setGroupSection(section: string | null, keys: string[]) {
    const value = section?.trim() || null;
    setIngredients((prev) =>
      prev.map((r) => (keys.includes(r.key) ? { ...r, section: value } : r))
    );
  }

  function addIngredientInGroup(section: string | null) {
    setIngredients((prev) => [...prev, emptyIngredient(section)]);
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/recipes/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Kunde inte hämta recept");
        setSourceUrl(importUrl.trim());
        return;
      }

      setTitle(data.title ?? "");
      setSourceUrl(data.sourceUrl ?? importUrl.trim());
      if (data.imageUrl) setImageUrl(data.imageUrl);

      const ings = (data.ingredients ?? []) as {
        name: string;
        quantity?: number;
        unit?: string;
        section?: string;
      }[];
      setIngredients(
        ings.length > 0
          ? ings.map((i) => ({
              key: crypto.randomUUID(),
              name: i.name,
              quantity: i.quantity ?? null,
              unit: i.unit ?? null,
              notes: null,
              section: i.section ?? null,
            }))
          : [emptyIngredient()]
      );

      const steps = (data.instructions ?? []) as string[];
      setInstructionsText(formatInstructionSteps(steps));
      toast.success("Recept hämtat – justera och spara");
    } catch {
      toast.error("Kunde inte hämta recept");
      setSourceUrl(importUrl.trim());
    } finally {
      setImporting(false);
    }
  }

  function buildPayload(): RecipeUpsertPayload {
    const instructions = parseInstructionLines(instructionsText);

    return {
      title: title.trim() || "Namnlöst recept",
      source_url: sourceUrl.trim() || null,
      image_url: imageUrl.trim() || null,
      recipe_category_id: recipeCategoryId,
      instructions,
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i, index) => ({
          name: i.name.trim(),
          quantity: i.quantity ?? null,
          unit: i.unit?.trim() || null,
          notes: i.notes?.trim() || null,
          section: i.section?.trim() || null,
          sort_order: index,
        })),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!title.trim()) {
      toast.error("Ange en titel");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = buildPayload();

    try {
      if (isEdit && recipe) {
        await updateRecipe(supabase, recipe.id, payload);
        toast.success("Recept uppdaterat");
        router.push(`/h/${householdId}/recipes/${recipe.id}`);
      } else {
        const created = await createRecipe(supabase, householdId, userId, payload);
        toast.success("Recept sparat");
        router.push(`/h/${householdId}/recipes/${created.id}`);
      }
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.recipes(householdId),
      });
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.recipeCategories(householdId),
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Link
          href={
            isEdit && recipe
              ? `/h/${householdId}/recipes/${recipe.id}`
              : `/h/${householdId}/recipes`
          }
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-heading text-[length:var(--mati-text-title)] font-semibold">
          {isEdit ? "Redigera recept" : "Nytt recept"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {!isEdit && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Label className="text-xs text-muted-foreground">Från länk</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://…"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                className="h-[var(--mati-touch)] min-w-0 flex-1 rounded-xl"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={importing || !importUrl.trim()}
                className="h-[var(--mati-touch)] shrink-0 rounded-xl gap-1"
                onClick={handleImportUrl}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Hämta
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="recipeTitle">Titel</Label>
          <Input
            id="recipeTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="h-[var(--mati-touch)] rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recipeCategory">Kategori</Label>
          <select
            id="recipeCategory"
            value={recipeCategoryId ?? ""}
            onChange={(e) =>
              setRecipeCategoryId(e.target.value ? e.target.value : null)
            }
            className="h-[var(--mati-touch)] w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Ingen kategori</option>
            {recipeCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {recipeCategories.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Skapa kategorier under fliken Kategorier → Recept
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="sourceUrl">Källa (URL)</Label>
          <Input
            id="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="h-[var(--mati-touch)] rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Ingredienser</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
            >
              <Plus className="h-4 w-4" />
              Lägg till
            </Button>
          </div>
          <div className="space-y-4">
            {ingredientGroups.map((group, gi) => {
              const groupKeys = group.items.map((r) => r.key);
              return (
                <div
                  key={groupKeys.join("-") || gi}
                  className="space-y-2 rounded-xl border border-border/50 bg-card/50 p-2"
                >
                  <Input
                    placeholder="Rubrik (t.ex. Biffar, Tzatziki)"
                    value={group.section ?? ""}
                    onChange={(e) => setGroupSection(e.target.value, groupKeys)}
                    className="h-9 rounded-lg border-dashed font-medium"
                  />
                  <ul className="space-y-2">
                    {group.items.map((row, index) => (
                      <li
                        key={row.key}
                        className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 bg-card p-2"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <Input
                            placeholder="Ingrediens"
                            value={row.name}
                            onChange={(e) =>
                              updateIngredient(row.key, { name: e.target.value })
                            }
                            className="h-9 rounded-lg"
                          />
                        </div>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Antal"
                          value={row.quantity ?? ""}
                          onChange={(e) =>
                            updateIngredient(row.key, {
                              quantity: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            })
                          }
                          className="h-9 w-16 rounded-lg"
                        />
                        <select
                          value={row.unit ?? ""}
                          onChange={(e) =>
                            updateIngredient(row.key, {
                              unit: e.target.value || null,
                            })
                          }
                          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                        >
                          <option value="">–</option>
                          {UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          disabled={ingredients.length <= 1}
                          onClick={() =>
                            setIngredients((prev) =>
                              prev.filter((r) => r.key !== row.key)
                            )
                          }
                          aria-label={`Ta bort ingrediens ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full gap-1 text-muted-foreground"
                    onClick={() => addIngredientInGroup(group.section)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ingrediens i denna grupp
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() =>
              setIngredients((prev) => [...prev, emptyIngredient(null)])
            }
          >
            <Plus className="h-4 w-4" />
            Ny grupp
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">Gör så här</Label>
          <Textarea
            id="instructions"
            value={instructionsText}
            onChange={(e) => setInstructionsText(e.target.value)}
            rows={8}
            className="resize-y rounded-xl font-mono text-sm leading-relaxed"
            placeholder={
              "## Förbered\n1. Hacka löken\n\n## Blanda\n1. Blanda allt"
            }
          />
          <p className="text-xs text-muted-foreground">
            Fasrubrik med ## på egen rad, sedan numrerade steg (1. 2. 3. …)
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            className="h-[var(--mati-touch)] flex-1 rounded-xl"
            disabled={saving}
          >
            {saving ? "Sparar…" : isEdit ? "Spara" : "Skapa recept"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-[var(--mati-touch)] rounded-xl"
            onClick={() => router.back()}
          >
            Avbryt
          </Button>
        </div>
      </form>
    </div>
  );
}
