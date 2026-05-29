"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchMyMembership } from "@/lib/queries/households";
import { LAST_HOUSEHOLD_KEY, QUERY_KEYS } from "@/lib/constants";
import { useOnline } from "@/hooks/use-online";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function HouseholdManagement({
  householdId,
  userId,
  inviteCode: initialInviteCode,
}: {
  householdId: string;
  userId: string;
  inviteCode: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [inviteCode, setInviteCode] = useState(initialInviteCode);
  const [renewOpen, setRenewOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: membership } = useQuery({
    queryKey: QUERY_KEYS.myMembership(householdId, userId),
    queryFn: () => fetchMyMembership(createClient(), householdId, userId),
  });

  const isOwner = membership?.role === "owner";

  function copyCode() {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Kod kopierad");
  }

  async function renewCode() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("renew_household_invite_code", {
      p_household_id: householdId,
    });
    setBusy(false);
    setRenewOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInviteCode(data);
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.household(householdId) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events(householdId) });
    toast.success("Ny inbjudningskod skapad");
  }

  async function leaveHousehold() {
    if (!online) {
      toast.error("Ingen anslutning");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("leave_household", {
      p_household_id: householdId,
    });
    setBusy(false);
    setLeaveOpen(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (typeof window !== "undefined") {
      const last = localStorage.getItem(LAST_HOUSEHOLD_KEY);
      if (last === householdId) localStorage.removeItem(LAST_HOUSEHOLD_KEY);
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.households });
    toast.success("Du lämnade hushållet");
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Hushållskod</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-lg tracking-widest">
              {inviteCode}
            </code>
            <Button variant="outline" size="icon" onClick={copyCode} aria-label="Kopiera kod">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setRenewOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              Förnya inbjudningskod
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {isOwner
              ? "Förnya koden om den delats med fel person. Gamla koder slutar fungera."
              : "Dela koden med nya medlemmar så de kan gå med."}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Lämna hushåll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Som ägare måste du överföra ägarskap innan du lämnar, om det finns fler medlemmar. Om du är ensam tas hela hushållet bort."
              : "Du tas bort från hushållet men dina listor finns kvar för övriga medlemmar."}
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setLeaveOpen(true)}
          >
            <LogOut className="h-4 w-4" />
            Lämna hushåll
          </Button>
        </CardContent>
      </Card>

      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Förnya inbjudningskod?</DialogTitle>
            <DialogDescription>
              Den gamla koden slutar fungera direkt. Medlemmar som redan gått med påverkas
              inte.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRenewOpen(false)}>
              Avbryt
            </Button>
            <Button className="flex-1" disabled={busy} onClick={renewCode}>
              Förnya
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lämna hushållet?</DialogTitle>
            <DialogDescription>
              {isOwner
                ? "Bekräfta att du vill lämna. Om du är ensam ägare raderas hushållet permanent."
                : "Du kan gå med igen med en inbjudningskod."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setLeaveOpen(false)}>
              Avbryt
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={busy}
              onClick={leaveHousehold}
            >
              Lämna
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
