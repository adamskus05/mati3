"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchHouseholdAuditLog } from "@/lib/queries/households";
import { QUERY_KEYS } from "@/lib/constants";
import { profileDisplayName } from "@/lib/profiles/display-name";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";

export function AuditLogPanel({ householdId }: { householdId: string }) {
  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.auditLog(householdId),
    queryFn: () => fetchHouseholdAuditLog(createClient(), householdId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Audit-logg</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Laddar…</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Audit-logg</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Kunde inte hämta audit-logg. Kör senaste databasmigrationen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Audit-logg</CardTitle>
        <p className="text-xs text-muted-foreground">
          Teknisk logg för ägare — medlemsborttagning, ägarskap, inbjudningskod m.m.
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Inga audit-händelser ännu</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AuditRow({
  entry,
}: {
  entry: Awaited<ReturnType<typeof fetchHouseholdAuditLog>>[number];
}) {
  const [open, setOpen] = useState(false);
  const actor = profileDisplayName(entry.actor ?? undefined);
  const meta =
    entry.metadata && typeof entry.metadata === "object"
      ? JSON.stringify(entry.metadata, null, 2)
      : String(entry.metadata ?? "");

  return (
    <li className="px-3 py-2">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="font-mono text-xs text-foreground">{entry.action}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {actor} ·{" "}
            {new Date(entry.created_at).toLocaleString("sv-SE")}
            {entry.resource_type && (
              <>
                {" "}
                · {entry.resource_type}
                {entry.resource_id ? `:${entry.resource_id}` : ""}
              </>
            )}
          </span>
        </span>
      </button>
      {open && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {meta}
        </pre>
      )}
    </li>
  );
}
