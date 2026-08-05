"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createRecipe,
  instructionsFromJson,
  updateRecipe,
  type RecipeUpsertPayload,
} from "@/lib/queries/recipes";
import type {
  RecipeIngredientInput,
  RecipeWithCategory,
  RecipeWithIngredients,
} from "@/lib/database.types";
import { fetchRecipeCategories } from "@/lib/queries/recipe-categories";
import { QUERY_KEYS, UNITS } from "@/lib/constants";
import {
  formatInstructionSteps,
  groupIngredientsBySection,
  MATI_INGREDIENT_LIST_CLASS,
  parseInstructionLines,
} from "@/lib/recipes/instruction-format";
import {
  applyImportedRecipe,
  edgeFunctionErrorMessage,
  type ImportedRecipePayload,
} from "@/lib/recipes/apply-import";
import { compressRecipeImage } from "@/lib/recipes/compress-recipe-image";
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
  const searchParams = useSearchParams();
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
  const photoInputRef = useRef<HTMLInputElement>(null);
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

  const autoImportDone = useRef(false);

  useEffect(() => {
    if (!isEdit && searchParams.get("import") === "1") {
      document.getElementById("recipeImportUrl")?.focus();
    }
  }, [isEdit, searchParams]);

  useEffect(() => {
    const paramUrl = searchParams.get("importUrl")?.trim();
    if (isEdit || !paramUrl || autoImportDone.current) return;
    setImportUrl(paramUrl);
  }, [isEdit, searchParams]);

  useEffect(() => {
    const paramUrl = searchParams.get("importUrl")?.trim();
    if (
      isEdit ||
      !paramUrl ||
      autoImportDone.current ||
      !online ||
      importUrl.trim() !== paramUrl ||
      importing
    ) {
      return;
    }
    autoImportDone.current = true;
    void handleImportUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per share deep-link
  }, [importUrl, isEdit, online, importing, searchParams]);

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

  function applyImportToForm(payload: ImportedRecipePayload, fallbackSource = "") {
    const applied = applyImportedRecipe(payload, fallbackSource);
    setTitle(applied.title);
    setSourceUrl(applied.sourceUrl);
    if (applied.imageUrl) setImageUrl(applied.imageUrl);
    setIngredients(applied.ingredients);
    setInstructionsText(applied.instructionsText);
  }

  async function handleImportUrl() {
    if (!importUrl.trim()) return;
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }

    setImporting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("recipe-import-url", {
        body: { url: importUrl.trim() },
      });

      if (error) {
        toast.error(await edgeFunctionErrorMessage(error));
        setSourceUrl(importUrl.trim());
        return;
      }

      const payload = data as ImportedRecipePayload;
      if (payload?.error) {
        toast.error(payload.error);
        setSourceUrl(importUrl.trim());
        return;
      }

      applyImportToForm(payload, importUrl.trim());
      toast.success("Recept hämtat – justera och spara");
    } catch {
      toast.error("Kunde inte hämta recept");
      setSourceUrl(importUrl.trim());
    } finally {
      setImporting(false);
    }
  }

  async function handleImportPhoto(file: File | null) {
    if (!file) return;
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Välj en bildfil");
      return;
    }

    setImporting(true);
    try {
      const supabase = createClient();
      const compressed = await compressRecipeImage(file);
      const path = `${userId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("recipe-images")
        .upload(path, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        });
      if (uploadError) {
        toast.error(uploadError.message || "Kunde inte ladda upp bilden");
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("recipe-images").getPublicUrl(path);

      const { data, error } = await supabase.functions.invoke(
        "recipe-import-image",
        { body: { imageUrl: publicUrl } }
      );

      if (error) {
        toast.error(await edgeFunctionErrorMessage(error, "Kunde inte tolka receptfoto"));
        setImageUrl(publicUrl);
        return;
      }

      const payload = data as ImportedRecipePayload;
      if (payload?.error) {
        toast.error(payload.error);
        setImageUrl(publicUrl);
        return;
      }

      applyImportToForm(
        { ...payload, imageUrl: payload.imageUrl ?? publicUrl },
        ""
      );
      toast.success("Recept tolkat från foto – justera och spara");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte tolka receptfoto");
    } finally {
      setImporting(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
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
    const recipesKey = QUERY_KEYS.recipes(householdId);
    const previousRecipes =
      queryClient.getQueryData<RecipeWithCategory[]>(recipesKey);
    const selectedCategory = recipeCategories.find(
      (c) => c.id === recipeCategoryId
    );
    const now = new Date().toISOString();

    if (isEdit && recipe) {
      const optimistic: RecipeWithCategory = {
        ...recipe,
        title: payload.title,
        source_url: payload.source_url ?? null,
        image_url: payload.image_url ?? null,
        recipe_category_id: payload.recipe_category_id ?? null,
        recipe_category: selectedCategory
          ? { id: selectedCategory.id, name: selectedCategory.name, color: selectedCategory.color }
          : null,
        updated_at: now,
      };
      queryClient.setQueryData<RecipeWithCategory[]>(recipesKey, (old) =>
        old?.map((r) => (r.id === recipe.id ? optimistic : r))
      );
      router.push(`/h/${householdId}/recipes/${recipe.id}`);

      try {
        await updateRecipe(supabase, recipe.id, payload);
        toast.success("Recept uppdaterat");
        void queryClient.invalidateQueries({ queryKey: recipesKey });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Kunde inte spara");
        queryClient.setQueryData(recipesKey, previousRecipes);
      } finally {
        setSaving(false);
      }
      return;
    }

    const tempId = `optimistic-${crypto.randomUUID()}`;
    const optimisticNew: RecipeWithCategory = {
      id: tempId,
      household_id: householdId,
      title: payload.title,
      source_url: payload.source_url ?? null,
      image_url: payload.image_url ?? null,
      recipe_category_id: payload.recipe_category_id ?? null,
      recipe_category: selectedCategory
        ? { id: selectedCategory.id, name: selectedCategory.name, color: selectedCategory.color }
        : null,
      instructions: payload.instructions as RecipeWithCategory["instructions"],
      created_by: userId,
      created_at: now,
      updated_at: now,
      scale_anchor_ingredient_id: null,
      scale_new_quantity: null,
    };
    queryClient.setQueryData<RecipeWithCategory[]>(recipesKey, (old) => [
      optimisticNew,
      ...(old ?? []),
    ]);
    router.push(`/h/${householdId}/recipes`);

    try {
      const created = await createRecipe(supabase, householdId, userId, payload);
      queryClient.setQueryData<RecipeWithCategory[]>(recipesKey, (old) =>
        old?.map((r) => (r.id === tempId ? { ...created, recipe_category: created.recipe_category ?? optimisticNew.recipe_category } : r))
      );
      toast.success("Recept sparat");
      router.push(`/h/${householdId}/recipes/${created.id}`);
      void queryClient.invalidateQueries({ queryKey: recipesKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte spara");
      queryClient.setQueryData(recipesKey, previousRecipes);
      router.push(`/h/${householdId}/recipes/new`);
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
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Från länk</Label>
              <div className="flex gap-2">
                <Input
                  id="recipeImportUrl"
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
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Från foto</Label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) =>
                  void handleImportPhoto(e.target.files?.[0] ?? null)
                }
              />
              <Button
                type="button"
                variant="secondary"
                disabled={importing}
                className="h-[var(--mati-touch)] w-full rounded-xl gap-2"
                onClick={() => photoInputRef.current?.click()}
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Ta eller välj bild
              </Button>
              <p className="text-xs text-muted-foreground">
                Fotografera ett receptkort eller välj en bild – fälten fylls i
                automatiskt.
              </p>
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

        {imageUrl.trim() && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Bild</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={() => setImageUrl("")}
              >
                Ta bort
              </Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl.trim()}
              alt=""
              className="aspect-[16/9] w-full rounded-xl object-cover"
            />
          </div>
        )}

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
            <datalist id="recipe-unit-options">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
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
                  <ul className={MATI_INGREDIENT_LIST_CLASS}>
                    {group.items.map((row, index) => (
                      <li key={row.key}>
                        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 bg-card p-2">
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
                        <div className="flex shrink-0 items-end gap-1.5">
                          <div className="space-y-0.5">
                            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Antal
                            </span>
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              placeholder="–"
                              value={row.quantity ?? ""}
                              onChange={(e) =>
                                updateIngredient(row.key, {
                                  quantity: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                })
                              }
                              className="h-9 w-16 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Enhet
                            </span>
                            <input
                              list="recipe-unit-options"
                              placeholder="–"
                              value={row.unit ?? ""}
                              onChange={(e) =>
                                updateIngredient(row.key, {
                                  unit: e.target.value.trim() || null,
                                })
                              }
                              className="h-9 w-20 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              aria-label="Enhet"
                            />
                          </div>
                        </div>
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
                        </div>
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
