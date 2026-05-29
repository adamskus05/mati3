"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getNextSortOrder } from "@/lib/items/sort-order";
import { UNITS } from "@/lib/constants";
import type { Category, ShoppingItem } from "@/lib/database.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";

export function ItemFormDialog({
  open,
  onOpenChange,
  listId,
  categories,
  item,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  categories: Category[];
  item?: ShoppingItem;
  onSuccess: () => void;
}) {
  const online = useOnline();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("st");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQuantity(item.quantity?.toString() ?? "");
      setUnit(item.unit ?? "st");
      setCategoryId(item.category_id ?? "none");
      setNotes(item.notes ?? "");
    } else {
      setName("");
      setQuantity("");
      setUnit("st");
      setCategoryId("none");
      setNotes("");
    }
  }, [item, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!name.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const catId = categoryId === "none" ? null : categoryId;
    const payload = {
      name: name.trim(),
      quantity: quantity ? parseFloat(quantity) : null,
      unit: unit || null,
      category_id: catId,
      notes: notes.trim() || null,
    };

    if (item) {
      const { error } = await supabase
        .from("shopping_items")
        .update(payload)
        .eq("id", item.id);
      setLoading(false);
      if (error) toast.error(error.message);
      else onSuccess();
    } else {
      const sort_order = await getNextSortOrder(supabase, listId, catId);
      const { error } = await supabase.from("shopping_items").insert({
        shopping_list_id: listId,
        ...payload,
        sort_order,
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Redigera vara" : "Lägg till vara"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itemName">Namn</Label>
            <Input
              id="itemName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mjölk"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="qty">Antal</Label>
              <Input
                id="qty"
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Enhet</Label>
              <Select value={unit} onValueChange={(v) => v && setUnit(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => v && setCategoryId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Okategoriserad</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Kommentar</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {item ? "Spara" : "Lägg till"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
