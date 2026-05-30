"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchActiveLists } from "@/lib/queries/lists";
import { exportRecipeToList } from "@/lib/recipes/export-to-list";
import { createListAndExportRecipe } from "@/lib/recipes/create-list-and-export";
import { QUERY_KEYS } from "@/lib/constants";
import { useOnline } from "@/hooks/use-online";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function ExportRecipeDialog({
  open,
  onOpenChange,
  householdId,
  recipeId,
  recipeTitle,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  recipeId: string;
  recipeTitle: string;
  userId: string;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [listId, setListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultListId, setResultListId] = useState<string | null>(null);

  const { data: lists = [] } = useQuery({
    queryKey: QUERY_KEYS.lists(householdId),
    queryFn: () => fetchActiveLists(createClient(), householdId),
    enabled: open,
  });

  async function handleExport() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      let targetListId = listId;
      let count = 0;

      if (mode === "new") {
        if (!newListName.trim()) {
          toast.error("Ange ett namn på listan");
          setLoading(false);
          return;
        }
        const result = await createListAndExportRecipe(
          supabase,
          householdId,
          userId,
          recipeId,
          newListName.trim()
        );
        targetListId = result.listId;
        count = result.itemCount;
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.lists(householdId),
        });
      } else {
        if (!listId) {
          toast.error("Välj en lista");
          setLoading(false);
          return;
        }
        count = await exportRecipeToList(supabase, recipeId, listId);
      }

      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.items(targetListId),
      });

      setResultListId(targetListId);
      toast.success(
        count > 0
          ? `${count} varor lades till i listan`
          : "Receptet har inga ingredienser att exportera"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export misslyckades");
    } finally {
      setLoading(false);
    }
  }

  function handleClose(next: boolean) {
    if (!next) {
      setResultListId(null);
      setMode("existing");
      setListId("");
      setNewListName("");
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportera till inköpslista</DialogTitle>
        </DialogHeader>

        {resultListId ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingredienser från &quot;{recipeTitle}&quot; är tillagda.
            </p>
            <Link
              href={`/h/${householdId}/lists/${resultListId}`}
              className="inline-flex h-[var(--mati-touch)] w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground"
            >
              Öppna listan
            </Link>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => handleClose(false)}
            >
              Stäng
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "existing" ? "default" : "outline"}
                className="flex-1 rounded-xl"
                onClick={() => setMode("existing")}
              >
                Befintlig lista
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "new" ? "default" : "outline"}
                className="flex-1 rounded-xl"
                onClick={() => setMode("new")}
              >
                Ny lista
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="exportList">Lista</Label>
                <select
                  id="exportList"
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  className="flex h-[var(--mati-touch)] w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="">Välj lista…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="newListName">Namn på ny lista</Label>
                <Input
                  id="newListName"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder={recipeTitle}
                  className="h-[var(--mati-touch)] rounded-xl"
                />
              </div>
            )}

            <Button
              type="button"
              className="h-[var(--mati-touch)] w-full rounded-xl"
              disabled={loading}
              onClick={handleExport}
            >
              {loading ? "Exporterar…" : "Exportera ingredienser"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
