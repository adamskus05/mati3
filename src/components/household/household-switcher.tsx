"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Home, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUserHouseholds } from "@/lib/queries/households";
import { LAST_HOUSEHOLD_KEY, QUERY_KEYS } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function HouseholdSwitcher({
  currentHouseholdId,
  currentName,
}: {
  currentHouseholdId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);

  const { data: households = [] } = useQuery({
    queryKey: QUERY_KEYS.households,
    queryFn: () => fetchUserHouseholds(createClient()),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="flex max-w-[200px] items-center gap-1 rounded-lg px-1 py-0.5 text-left active:opacity-80"
        aria-label="Byt hushåll"
      >
        <span className="truncate font-heading text-lg font-semibold">
          {currentName}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Byt hushåll</SheetTitle>
        </SheetHeader>
        <ul className="mt-4 space-y-1">
          {households.map((h) => (
            <li key={h.id}>
              <Link
                href={`/h/${h.id}`}
                onClick={() => {
                  localStorage.setItem(LAST_HOUSEHOLD_KEY, h.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm active:bg-muted ${
                  h.id === currentHouseholdId ? "bg-primary/10 font-medium" : ""
                }`}
              >
                <Home className="h-4 w-4 shrink-0" />
                <span className="truncate">{h.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium active:bg-muted"
        >
          <Plus className="h-4 w-4" />
          Hantera / gå med i hushåll
        </Link>
      </SheetContent>
    </Sheet>
  );
}
