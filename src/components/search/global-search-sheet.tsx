"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ChefHat,
  List,
  Package,
  Search,
  Tags,
  UtensilsCrossed,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { searchHousehold, type HouseholdSearchResult } from "@/lib/queries/search";
import { QUERY_KEYS } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";

const KIND_LABEL: Record<HouseholdSearchResult["kind"], string> = {
  recipe: "Recept",
  list: "Listor",
  item: "Varor",
  category: "Kategorier",
  recipe_category: "Receptkategorier",
};

const KIND_ICON: Record<
  HouseholdSearchResult["kind"],
  React.ComponentType<{ className?: string }>
> = {
  recipe: ChefHat,
  list: List,
  item: Package,
  category: Tags,
  recipe_category: UtensilsCrossed,
};

function groupResults(results: HouseholdSearchResult[]) {
  const groups = new Map<HouseholdSearchResult["kind"], HouseholdSearchResult[]>();
  for (const row of results) {
    const list = groups.get(row.kind) ?? [];
    list.push(row);
    groups.set(row.kind, list);
  }
  return groups;
}

export function GlobalSearchSheet({
  open,
  onOpenChange,
  householdId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      return;
    }
    const t = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query, open]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: QUERY_KEYS.search(householdId, debounced),
    queryFn: () => searchHousehold(createClient(), householdId, debounced),
    enabled: open && debounced.length >= 1,
    staleTime: 10_000,
  });

  const grouped = useMemo(() => groupResults(results), [results]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Sök i hushållet</SheetTitle>
        </SheetHeader>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Recept, listor, varor, kategorier…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[var(--mati-touch)] rounded-xl pl-9"
          />
        </div>

        <div className="mt-4 max-h-[55vh] overflow-y-auto pb-4">
          {debounced.length < 1 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Börja skriva för att söka
            </p>
          ) : isFetching && results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Söker…</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Inga träffar
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([kind, rows]) => {
                const Icon = KIND_ICON[kind];
                return (
                  <div key={kind}>
                    <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {KIND_LABEL[kind]}
                    </p>
                    <ul className="overflow-hidden rounded-xl border border-border/60 bg-card">
                      {rows.map((row) => (
                        <li key={`${kind}-${row.id}`}>
                          <Link
                            href={row.href}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 active:bg-muted"
                            onClick={() => onOpenChange(false)}
                          >
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {row.title}
                              </span>
                              {row.subtitle && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {row.subtitle}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
