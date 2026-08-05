"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ListsView } from "@/components/lists/lists-view";
import { CategoriesHub } from "@/components/categories/categories-hub";

type ListsTab = "lists" | "categories";

function parseTab(raw: string | null): ListsTab {
  return raw === "categories" ? "categories" : "lists";
}

export function ListsHub({ householdId }: { householdId: string }) {
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  return (
    <div className="space-y-4">
      <div
        className="flex rounded-xl border border-border/60 bg-muted/30 p-1"
        role="tablist"
        aria-label="Listor och kategorier"
      >
        <Link
          href={`/h/${householdId}`}
          scroll={false}
          role="tab"
          aria-selected={tab === "lists"}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
            tab === "lists"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Listor
        </Link>
        <Link
          href={`/h/${householdId}?tab=categories`}
          scroll={false}
          role="tab"
          aria-selected={tab === "categories"}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
            tab === "categories"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Kategorier
        </Link>
      </div>

      {tab === "categories" ? (
        <CategoriesHub householdId={householdId} embedded />
      ) : (
        <ListsView householdId={householdId} />
      )}
    </div>
  );
}
