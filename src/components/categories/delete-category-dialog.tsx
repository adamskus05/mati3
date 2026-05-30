"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS } from "@/lib/constants";
import type { Category } from "@/lib/database.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";

export function DeleteCategoryDialog({
  category,
  categories,
  householdId,
  onClose,
}: {
  category: Category;
  categories: Category[];
  householdId: string;
  onClose: () => void;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState<string>("uncategorized");
  const [mode, setMode] = useState<"move" | "uncategorize">("move");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    setDeleting(true);
    const catKey = QUERY_KEYS.categories(householdId);
    const previousCats = queryClient.getQueryData<Category[]>(catKey);
    queryClient.setQueryData<Category[]>(catKey, (old) =>
      old?.filter((c) => c.id !== category.id)
    );
    onClose();

    const supabase = createClient();

    const { data: items } = await supabase
      .from("shopping_items")
      .select("id, shopping_list_id")
      .eq("category_id", category.id);

    if (items?.length) {
      if (mode === "move" && targetId !== "uncategorized") {
        const { error } = await supabase
          .from("shopping_items")
          .update({ category_id: targetId })
          .eq("category_id", category.id);
        if (error) {
          toast.error(error.message);
          setDeleting(false);
          queryClient.setQueryData(catKey, previousCats);
          return;
        }
      } else {
        const { error } = await supabase
          .from("shopping_items")
          .update({ category_id: null })
          .eq("category_id", category.id);
        if (error) {
          toast.error(error.message);
          setDeleting(false);
          queryClient.setQueryData(catKey, previousCats);
          return;
        }
      }
    }

    const { error } = await supabase.from("categories").delete().eq("id", category.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(catKey, previousCats);
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.categories(householdId),
    });
    toast.success("Kategori borttagen");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Ta bort &quot;{category.name}&quot;?</DialogTitle>
          <DialogDescription>
            Vad ska hända med varor i denna kategori?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Åtgärd</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "move" | "uncategorize")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="move">Flytta till annan kategori</SelectItem>
                <SelectItem value="uncategorize">
                  Ta bort kategorikoppling (okategoriserad)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "move" && (
            <div className="space-y-2">
              <Label>Målkategori</Label>
              <Select
                value={targetId}
                onValueChange={(v) => v && setTargetId(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Tar bort…" : "Ta bort"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
