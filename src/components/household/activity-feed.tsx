"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchHouseholdEvents, fetchMembers } from "@/lib/queries/households";
import { QUERY_KEYS } from "@/lib/constants";
import { useHouseholdRealtime } from "@/hooks/use-realtime";
import { formatHouseholdEvent } from "@/lib/household/event-labels";
import { profileDisplayName } from "@/lib/profiles/display-name";

export function ActivityFeed({
  householdId,
  userId,
}: {
  householdId: string;
  userId: string;
}) {
  useHouseholdRealtime(householdId);

  const { data: events = [] } = useQuery({
    queryKey: QUERY_KEYS.events(householdId),
    queryFn: () => fetchHouseholdEvents(createClient(), householdId),
  });

  const { data: members = [] } = useQuery({
    queryKey: QUERY_KEYS.members(householdId),
    queryFn: () => fetchMembers(createClient(), householdId),
  });

  const membersByUserId = useMemo(() => {
    const map = new Map<string, { display_name?: string | null; email?: string | null }>();
    for (const m of members) {
      map.set(m.user_id, m.profile);
    }
    return map;
  }, [members]);

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
              event.metadata,
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
