"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createRecipe,
  instructionsFromJson,
  updateRecipe,
  type RecipeUpsertPayload,
} from "@/lib/queries/recipes";
import type { RecipeIngredientInput, RecipeWithIngredients } from "@/lib/database.types";
import { UNITS } from "@/lib/constants";
import {
  formatInstructionSteps,
  parseInstructionLines,
} from "@/lib/recipes/instruction-format";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
type IngredientRow = RecipeIngredientInput & { key: string };

function emptyIngredient(): IngredientRow {
  return { key: crypto.randomUUID(), name: "", quantity: null, unit: null, notes: null };
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
  const online = useOnline();
  const isEdit = Boolean(recipe);

  const [title, setTitle] = useState(recipe?.title ?? "");
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
        }))
      : [emptyIngredient()]
  );
  const [instructionsText, setInstructionsText] = useState(() =>
    recipe
      ? formatInstructionSteps(instructionsFromJson(recipe.instructions))
      : ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recipe) return;
    setTitle(recipe.title);
    setSourceUrl(recipe.source_url ?? "");
    setImageUrl(recipe.image_url ?? "");
    setIngredients(
      recipe.recipe_ingredients.map((i) => ({
        key: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
      }))
    );
    setInstructionsText(
      formatInstructionSteps(instructionsFromJson(recipe.instructions))
    );
  }, [recipe]);

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
      }[];
      setIngredients(
        ings.length > 0
          ? ings.map((i) => ({
              key: crypto.randomUUID(),
              name: i.name,
              quantity: i.quantity ?? null,
              unit: i.unit ?? null,
              notes: null,
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
      instructions,
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i, index) => ({
          name: i.name.trim(),
          quantity: i.quantity ?? null,
          unit: i.unit?.trim() || null,
          notes: i.notes?.trim() || null,
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
          <ul className="space-y-2">
            {ingredients.map((row, index) => (
              <li
                key={row.key}
                className="flex flex-wrap items-end gap-2 rounded-xl border border-border/50 bg-card p-2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    placeholder="Ingrediens"
                    value={row.name}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((r) =>
                          r.key === row.key ? { ...r, name: e.target.value } : r
                        )
                      )
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
                    setIngredients((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? {
                              ...r,
                              quantity: e.target.value
                                ? parseFloat(e.target.value)
                                : null,
                            }
                          : r
                      )
                    )
                  }
                  className="h-9 w-16 rounded-lg"
                />
                <select
                  value={row.unit ?? ""}
                  onChange={(e) =>
                    setIngredients((prev) =>
                      prev.map((r) =>
                        r.key === row.key
                          ? { ...r, unit: e.target.value || null }
                          : r
                      )
                    )
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
                    setIngredients((prev) => prev.filter((r) => r.key !== row.key))
                  }
                  aria-label={`Ta bort ingrediens ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">Gör så här</Label>
          <Textarea
            id="instructions"
            value={instructionsText}
            onChange={(e) => setInstructionsText(e.target.value)}
            rows={8}
            className="resize-y rounded-xl font-mono text-sm leading-relaxed"
            placeholder={"1. Förbered ingredienserna\n2. Blanda och laga\n3. Servera"}
          />
          <p className="text-xs text-muted-foreground">
            Ett numrerat steg per rad (1. 2. 3. …)
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
