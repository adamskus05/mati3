"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchUserHouseholds } from "@/lib/queries/households";
import { QUERY_KEYS, LAST_HOUSEHOLD_KEY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";
import { Home, Plus } from "lucide-react";
import { showQueryLoading } from "@/lib/query/loading";

export function HouseholdHub() {
  const router = useRouter();
  const online = useOnline();
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: households = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.households,
    queryFn: () => fetchUserHouseholds(createClient()),
  });

  useEffect(() => {
    if (isLoading || households.length !== 1) return;
    const last = localStorage.getItem(LAST_HOUSEHOLD_KEY);
    if (!last) {
      localStorage.setItem(LAST_HOUSEHOLD_KEY, households[0].id);
      router.push(`/h/${households[0].id}`);
    }
  }, [households, isLoading, router]);

  function goToHousehold(id: string) {
    localStorage.setItem(LAST_HOUSEHOLD_KEY, id);
    router.push(`/h/${id}`);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!createName.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_household", {
      p_name: createName.trim(),
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Hushåll skapat!");
    goToHousehold(data.id);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    if (!joinCode.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_household_by_code", {
      p_code: joinCode.trim(),
    });
    setLoading(false);
    if (error) {
      const msg = error.message.includes("För många försök")
        ? error.message
        : "Ogiltig hushållskod";
      toast.error(msg);
      return;
    }
    toast.success("Du gick med i hushållet!");
    goToHousehold(data.id);
  }

  if (showQueryLoading(isLoading, households)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-muted-foreground">Laddar…</p>
      </div>
    );
  }

  const lastId =
    typeof window !== "undefined"
      ? localStorage.getItem(LAST_HOUSEHOLD_KEY)
      : null;
  const lastHousehold = households.find((h) => h.id === lastId);

  return (
    <div className="flex min-h-dvh flex-col bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md space-y-6 pt-8">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-primary">Mati</h1>
          <p className="mt-1 text-muted-foreground">Gemensamma inköpslistor</p>
        </div>

        {lastHousehold && (
          <Link
            href={`/h/${lastHousehold.id}`}
            prefetch
            onClick={() => localStorage.setItem(LAST_HOUSEHOLD_KEY, lastHousehold.id)}
            className="block rounded-2xl transition-shadow hover:shadow-md active:scale-[0.99] active:opacity-90"
          >
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <Home className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">
                  Fortsätt till {lastHousehold.name}
                </CardTitle>
              </CardHeader>
            </Card>
          </Link>
        )}

        {households.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Dina hushåll</p>
            {households.map((h) => (
              <Link
                key={h.id}
                href={`/h/${h.id}`}
                prefetch
                onClick={() => localStorage.setItem(LAST_HOUSEHOLD_KEY, h.id)}
                className="block rounded-2xl active:scale-[0.99] active:opacity-90"
              >
                <Card className="rounded-2xl">
                  <CardContent className="flex items-center justify-between py-4">
                    <span className="font-medium">{h.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {h.invite_code}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="create">Skapa</TabsTrigger>
            <TabsTrigger value="join">Gå med</TabsTrigger>
          </TabsList>
          <TabsContent value="create">
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="householdName">Hushållsnamn</Label>
                <Input
                  id="householdName"
                  placeholder="t.ex. Villa Sol"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <Plus className="h-4 w-4" />
                Skapa hushåll
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="join">
            <form onSubmit={handleJoin} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Hushållskod</Label>
                <Input
                  id="inviteCode"
                  placeholder="ABC1234"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Gå med
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
