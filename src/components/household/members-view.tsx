"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchMembers, fetchMyMembership } from "@/lib/queries/households";
import { QUERY_KEYS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { useOnline } from "@/hooks/use-online";
import { roleLabel } from "@/lib/household/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityFeed } from "@/components/household/activity-feed";
import { MembersSkeleton } from "@/components/household/members-skeleton";
import type { MemberWithProfile } from "@/lib/database.types";
import { profileDisplayName } from "@/lib/profiles/display-name";
import { Crown, UserMinus } from "lucide-react";
import { toast } from "sonner";

export function MembersView({
  householdId,
  userId,
}: {
  householdId: string;
  userId: string;
}) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [transferTarget, setTransferTarget] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useHouseholdRealtime(householdId);

  const {
    data: membership,
    isError: membershipError,
  } = useQuery({
    queryKey: QUERY_KEYS.myMembership(householdId, userId),
    queryFn: () => fetchMyMembership(createClient(), householdId, userId),
    throwOnError: false,
  });

  const {
    data: members = [],
    isLoading,
    isError: membersError,
    error: membersQueryError,
  } = useQuery({
    queryKey: QUERY_KEYS.members(householdId),
    queryFn: () => fetchMembers(createClient(), householdId),
    staleTime: 60_000,
    throwOnError: false,
  });

  const membersPending = isLoading && members.length === 0;

  const isOwner = membership?.role === "owner";
  const otherMembers = members.filter((m) => m.user_id !== userId);

  async function transferOwnership() {
    if (!transferTarget || !online) return;
    setBusy(true);
    const { error } = await createClient().rpc("transfer_household_ownership", {
      p_household_id: householdId,
      p_new_owner_user_id: transferTarget.userId,
    });
    setBusy(false);
    setTransferTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.members(householdId) });
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.myMembership(householdId, userId),
    });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events(householdId) });
    toast.success("Ägarskap överfört");
  }

  async function removeMember(targetUserId: string, name: string) {
    if (!online || !isOwner) return;
    if (!confirm(`Ta bort ${name} från hushållet?`)) return;

    const key = QUERY_KEYS.members(householdId);
    const previous = queryClient.getQueryData<MemberWithProfile[]>(key);
    queryClient.setQueryData<MemberWithProfile[]>(key, (old) =>
      old?.filter((m) => m.user_id !== targetUserId)
    );

    const { error } = await createClient().rpc("remove_household_member", {
      p_household_id: householdId,
      p_user_id: targetUserId,
    });
    if (error) {
      toast.error(error.message);
      queryClient.setQueryData(key, previous);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.events(householdId) });
    toast.success(`${name} borttagen`);
  }

  if (membersError) {
    return (
      <div className="space-y-2">
        <h1 className="font-heading text-xl font-semibold">Medlemmar</h1>
        <p className="text-sm text-destructive">
          Kunde inte hämta medlemmar:{" "}
          {membersQueryError instanceof Error
            ? membersQueryError.message
            : "Okänt fel"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Medlemmar</h1>
        <p className="text-xs text-muted-foreground">
          {members.length} medlem{members.length === 1 ? "" : "mar"}
        </p>
      </div>

      {membersPending ? (
        <MembersSkeleton />
      ) : (
      <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
        {members.map((m) => {
          const name =
            m.user_id === userId ? "Du" : profileDisplayName(m.profile);
          const initials = profileDisplayName(m.profile).slice(0, 2).toUpperCase() || "?";
          const isSelf = m.user_id === userId;
          const label = roleLabel(m.role);

          return (
            <li key={m.id}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <Badge
                      variant={m.role === "owner" ? "default" : "secondary"}
                      className="shrink-0 gap-0.5 px-1.5 py-0 text-[10px]"
                    >
                      {m.role === "owner" ? (
                        <Crown className="h-3 w-3" aria-hidden />
                      ) : null}
                      {label}
                    </Badge>
                  </div>
                  {m.profile?.email ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {m.profile.email}
                    </p>
                  ) : null}
                </div>
                {isOwner && !isSelf && (
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setTransferTarget({
                          userId: m.user_id,
                          name: profileDisplayName(m.profile),
                        })
                      }
                    >
                      Gör till ägare
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        removeMember(m.user_id, profileDisplayName(m.profile))
                      }
                      aria-label={`Ta bort ${profileDisplayName(m.profile)}`}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      )}

      {membershipError && (
        <p className="text-xs text-muted-foreground">
          Kunde inte verifiera din roll — vissa ägarfunktioner kan saknas.
        </p>
      )}

      {isOwner && otherMembers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Överför ägarskap innan du lämnar hushållet under Inställningar.
        </p>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Aktivitet</h2>
        <ActivityFeed householdId={householdId} userId={userId} />
      </div>

      <Dialog open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Överför ägarskap?</DialogTitle>
            <DialogDescription>
              {transferTarget?.name} blir ägare och du blir vanlig medlem. Detta kan inte
              ångras automatiskt.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setTransferTarget(null)}
            >
              Avbryt
            </Button>
            <Button className="flex-1" disabled={busy} onClick={transferOwnership}>
              Överför
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
