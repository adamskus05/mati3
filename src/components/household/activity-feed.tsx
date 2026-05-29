"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchHouseholdEvents, fetchMembers } from "@/lib/queries/households";
import { QUERY_KEYS } from "@/lib/constants";
import { formatHouseholdEvent } from "@/lib/household/event-labels";
import { isSchemaMissingError } from "@/lib/household/roles";

export function ActivityFeed({
  householdId,
  userId,
}: {
  householdId: string;
  userId: string;
}) {
  const {
    data: events = [],
    isError: eventsError,
    error: eventsQueryError,
  } = useQuery({
    queryKey: QUERY_KEYS.events(householdId),
    queryFn: () => fetchHouseholdEvents(createClient(), householdId),
    throwOnError: false,
  });

  const { data: members = [] } = useQuery({
    queryKey: QUERY_KEYS.members(householdId),
    queryFn: () => fetchMembers(createClient(), householdId),
    throwOnError: false,
  });

  const membersByUserId = useMemo(() => {
    const map = new Map<string, { display_name?: string | null; email?: string | null }>();
    for (const m of members) {
      map.set(m.user_id, m.profile);
    }
    return map;
  }, [members]);

  if (
    eventsError &&
    eventsQueryError &&
    typeof eventsQueryError === "object" &&
    "message" in eventsQueryError &&
    isSchemaMissingError(eventsQueryError as { code?: string; message?: string })
  ) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
        Aktivitetsloggen kräver en databasuppdatering. Kör migrationen{" "}
        <code className="text-xs">20250529100400_household_roles_events.sql</code> i
        Supabase.
      </p>
    );
  }

  if (eventsError) {
    return (
      <p className="text-sm text-destructive">
        Kunde inte hämta aktivitet:{" "}
        {eventsQueryError instanceof Error ? eventsQueryError.message : "Okänt fel"}
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Ingen aktivitet ännu
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
      {events.map((event) => (
        <li key={event.id} className="px-3 py-2.5">
          <p className="text-sm leading-snug">
            {formatHouseholdEvent(
              event.event_type,
              event.metadata ?? {},
              event.actor,
              membersByUserId,
              userId
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(event.created_at).toLocaleString("sv-SE", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}
