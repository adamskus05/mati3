"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

function recipesReturnHref(householdId: string): string {
  const fallback = `/h/${householdId}/recipes`;
  if (typeof window === "undefined") return fallback;
  try {
    const stored = sessionStorage.getItem(`mati:recipesReturn:${householdId}`);
    if (!stored || !stored.startsWith(`/h/${householdId}/recipes`)) {
      return fallback;
    }
    const pathOnly = stored.split("?")[0];
    // Only list URL (/recipes or /recipes?…), not /recipes/:id
    if (pathOnly === `/h/${householdId}/recipes`) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function RecipesBackLink({ householdId }: { householdId: string }) {
  const href = useMemo(() => recipesReturnHref(householdId), [householdId]);

  return (
    <Link
      href={href}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-muted"
      aria-label="Tillbaka till recept"
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  );
}
