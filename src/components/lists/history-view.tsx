"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchArchivedLists } from "@/lib/queries/lists";
import { QUERY_KEYS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { ListsSkeleton } from "@/components/lists/lists-skeleton";
import { profileDisplayName } from "@/lib/profiles/display-name";
import type { ShoppingListWithCreator } from "@/lib/database.types";

function historyMetaLine(list: ShoppingListWithCreator): string {
  const parts: string[] = [];
  if (list.deleted_at) {
    parts.push(
      `Arkiverad ${new Date(list.deleted_at).toLocaleDateString("sv-SE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    );
  }
  if (list.deleted_by_profile) {
    parts.push(`av ${profileDisplayName(list.deleted_by_profile)}`);
  }
  if (list.creator) {
    parts.push(`skapad av ${profileDisplayName(list.creator)}`);
  }
  return parts.join(" · ") || "Arkiverad lista";
}

export function HistoryView({ householdId }: { householdId: string }) {
  useHouseholdRealtime(householdId);

  const { data: lists = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.listHistory(householdId),
    queryFn: () => fetchArchivedLists(createClient(), householdId),
    staleTime: 60_000,
  });

  const listsPending = isLoading && lists.length === 0;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-heading text-[length:var(--mati-text-title)] font-semibold leading-tight">
          Historik
        </h1>
        <p className="text-[11px] text-muted-foreground">Arkiverade listor – endast läsning</p>
      </div>
      {listsPending ? (
        <ListsSkeleton />
      ) : lists.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Inga arkiverade listor
        </p>
      ) : (
        <ul className="space-y-1.5">
          {lists.map((list) => (
            <li key={list.id}>
              <Link
                href={`/h/${householdId}/history/${list.id}`}
                prefetch
                className="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-card py-2 pl-2.5 pr-2 transition-colors hover:bg-muted/40 active:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{list.name}</p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {historyMetaLine(list)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/80" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
