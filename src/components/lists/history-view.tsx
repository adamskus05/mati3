"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchArchivedLists } from "@/lib/queries/lists";
import { QUERY_KEYS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { Card, CardContent } from "@/components/ui/card";
import { showQueryLoading } from "@/lib/query/loading";
import { profileDisplayName } from "@/lib/profiles/display-name";

export function HistoryView({ householdId }: { householdId: string }) {
  useHouseholdRealtime(householdId);

  const { data: lists = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.listHistory(householdId),
    queryFn: () => fetchArchivedLists(createClient(), householdId),
  });

  if (showQueryLoading(isLoading, lists)) {
    return <p className="text-muted-foreground">Laddar…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-semibold">Historik</h1>
      <p className="text-sm text-muted-foreground">
        Arkiverade listor – endast läsning
      </p>
      {lists.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Inga arkiverade listor
        </p>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => (
            <li key={list.id}>
              <Card className="rounded-2xl">
                <Link
                  href={`/h/${householdId}/history/${list.id}`}
                  prefetch
                  className="block active:bg-muted/50"
                >
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{list.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Arkiverad{" "}
                        {list.deleted_at
                          ? new Date(list.deleted_at).toLocaleDateString("sv-SE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                        {list.deleted_by_profile && (
                          <>
                            {" · av "}
                            {profileDisplayName(list.deleted_by_profile)}
                          </>
                        )}
                      </p>
                      {list.creator && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Skapad av {profileDisplayName(list.creator)}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
