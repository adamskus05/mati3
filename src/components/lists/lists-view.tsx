"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchActiveLists } from "@/lib/queries/lists";
import { QUERY_KEYS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { showQueryLoading } from "@/lib/query/loading";

export function ListsView({ householdId }: { householdId: string }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useHouseholdRealtime(householdId);

  const { data: lists = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.lists(householdId),
    queryFn: () => fetchActiveLists(createClient(), householdId),
  });

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("shopping_lists").insert({
      household_id: householdId,
      name: name.trim(),
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setName("");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists(householdId) });
    toast.success("Lista skapad");
  }

  async function updateList(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !online) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_lists")
      .update({ name: editName.trim() })
      .eq("id", editId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditId(null);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists(householdId) });
  }

  async function deleteList(id: string) {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!confirm("Ta bort listan? Den sparas i historiken.")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("shopping_lists")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists(householdId) });
    toast.success("Lista borttagen");
  }

  if (showQueryLoading(isLoading, lists)) {
    return <p className="text-muted-foreground">Laddar listor…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Inköpslistor</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" />
            Ny lista
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Ny inköpslista</DialogTitle>
            </DialogHeader>
            <form onSubmit={createList} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="listName">Namn</Label>
                <Input
                  id="listName"
                  placeholder="Veckohandling"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Skapa
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lists.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Inga listor ännu. Skapa din första!
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => (
            <li key={list.id}>
              <Card className="rounded-2xl overflow-hidden">
                <CardContent className="flex items-center gap-2 p-0">
                  <Link
                    href={`/h/${householdId}/lists/${list.id}`}
                    prefetch
                    className="flex flex-1 items-center gap-3 p-4 transition-colors hover:bg-muted/50 active:bg-muted"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {list.creator?.display_name ?? "Okänd"} ·{" "}
                        {new Date(list.updated_at).toLocaleDateString("sv-SE", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                  <div className="flex pr-2 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditId(list.id);
                        setEditName(list.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteList(list.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Redigera lista</DialogTitle>
          </DialogHeader>
          <form onSubmit={updateList} className="space-y-4">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            <Button type="submit" className="w-full">
              Spara
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
