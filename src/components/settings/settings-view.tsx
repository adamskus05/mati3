"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { QUERY_KEYS, UNITS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import { updateDisplayName } from "@/lib/actions/auth";
import type { ItemPreset } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CategoryPicker } from "@/components/categories/category-picker";
import { ThemePicker } from "@/components/settings/theme-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { HouseholdManagement } from "@/components/household/household-management";
import { PushNotificationSettings } from "@/components/settings/push-notification-settings";
import { fetchUserHouseholds } from "@/lib/queries/households";
import { toast } from "sonner";

export function SettingsView({
  householdId,
  userId,
  inviteCode,
  householdName,
  profileName,
}: {
  householdId: string;
  userId: string;
  inviteCode: string;
  householdName: string;
  profileName: string;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profileName);
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetQty, setPresetQty] = useState("");
  const [presetUnit, setPresetUnit] = useState("st");
  const [presetCat, setPresetCat] = useState("none");

  useHouseholdRealtime(householdId);

  const { data: allHouseholds = [] } = useQuery({
    queryKey: QUERY_KEYS.households,
    queryFn: () => fetchUserHouseholds(createClient()),
    throwOnError: false,
  });

  const { data: categories = [] } = useQuery({
    queryKey: QUERY_KEYS.categories(householdId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("categories")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return data ?? [];
    },
    throwOnError: false,
  });

  const { data: presets = [] } = useQuery({
    queryKey: QUERY_KEYS.presets(householdId),
    queryFn: async () => {
      const { data } = await createClient()
        .from("item_presets")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      return data ?? [];
    },
    throwOnError: false,
  });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateDisplayName(displayName.trim());
      toast.success("Profil uppdaterad");
    } catch {
      toast.error("Kunde inte spara");
    }
  }

  async function addPreset(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    const maxOrder = presets.reduce((m, p) => Math.max(m, p.sort_order), -1);
    const { error } = await createClient().from("item_presets").insert({
      household_id: householdId,
      name: presetName.trim(),
      default_quantity: presetQty ? parseFloat(presetQty) : null,
      default_unit: presetUnit,
      category_id: presetCat === "none" ? null : presetCat,
      sort_order: maxOrder + 1,
    });
    if (error) toast.error(error.message);
    else {
      setPresetName("");
      setPresetQty("");
      setPresetOpen(false);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.presets(householdId) });
      toast.success("Snabbknapp tillagd");
    }
  }

  async function deletePreset(id: string) {
    if (!online) return;
    const { error } = await createClient().from("item_presets").delete().eq("id", id);
    if (error) toast.error(error.message);
    else
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.presets(householdId) });
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-xl font-semibold">Inställningar</h1>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Din profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="displayName">Visningsnamn</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm">
              Spara
            </Button>
          </form>
        </CardContent>
      </Card>

      <ThemePicker />

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Dina hushåll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {allHouseholds.map((h) => (
            <Link
              key={h.id}
              href={`/h/${h.id}`}
              className={`block rounded-lg border px-3 py-2 text-sm active:bg-muted ${
                h.id === householdId ? "border-primary bg-primary/5 font-medium" : ""
              }`}
            >
              {h.name}
            </Link>
          ))}
          <Link
            href="/"
            className="mt-2 flex w-full items-center justify-center rounded-md border px-3 py-2 text-sm font-medium active:bg-muted"
          >
            Skapa eller gå med i hushåll
          </Link>
        </CardContent>
      </Card>

      <HouseholdManagement
        householdId={householdId}
        userId={userId}
        inviteCode={inviteCode}
        householdName={householdName}
      />

      <PushNotificationSettings userId={userId} />

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Snabbknappar</CardTitle>
          <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
            <DialogTrigger className="inline-flex h-8 items-center justify-center gap-1 rounded-md border px-3 text-sm">
              <Plus className="h-4 w-4" />
              Lägg till
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Ny snabbknapp</DialogTitle>
              </DialogHeader>
              <form onSubmit={addPreset} className="space-y-4">
                <div className="space-y-2">
                  <Label>Namn</Label>
                  <Input
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Antal</Label>
                    <Input
                      type="number"
                      value={presetQty}
                      onChange={(e) => setPresetQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Enhet</Label>
                    <Select
                      value={presetUnit}
                      onValueChange={(v) => v && setPresetUnit(v)}
                    >
                      <SelectTrigger className="w-full">
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
                <CategoryPicker
                  categories={categories}
                  value={presetCat}
                  onChange={setPresetCat}
                  label="Standardkategori"
                />
                <Button type="submit" className="w-full">
                  Spara
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga snabbknappar ännu</p>
          ) : (
            <ul className="space-y-2">
              {presets.map((p: ItemPreset) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span>
                    {p.name}
                    {p.default_quantity != null && (
                      <span className="text-muted-foreground text-sm ml-1">
                        ({p.default_quantity} {p.default_unit})
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deletePreset(p.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
