"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchMembers } from "@/lib/queries/households";
import { QUERY_KEYS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { showQueryLoading } from "@/lib/query/loading";
import { profileDisplayName } from "@/lib/profiles/display-name";

export function MembersView({ householdId }: { householdId: string }) {
  useHouseholdRealtime(householdId);

  const { data: members = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.members(householdId),
    queryFn: () => fetchMembers(createClient(), householdId),
  });

  if (showQueryLoading(isLoading, members)) {
    return <p className="text-muted-foreground">Laddar…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-semibold">Medlemmar</h1>
      <ul className="space-y-2">
        {members.map((m) => {
          const name = profileDisplayName(m.profile);
          const initials = name.slice(0, 2).toUpperCase();
          return (
            <li key={m.id}>
              <Card className="rounded-2xl">
                <CardContent className="flex items-center gap-3 py-4">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {m.profile?.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gick med{" "}
                      {new Date(m.joined_at).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
