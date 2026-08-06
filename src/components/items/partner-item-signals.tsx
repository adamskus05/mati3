"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ShoppingItemWithCompleter } from "@/lib/database.types";
import { profileDisplayName } from "@/lib/profiles/display-name";

/**
 * Toast when partner adds an item while you're viewing the list.
 */
export function PartnerItemSignals({
  items,
  userId,
}: {
  items: ShoppingItemWithCompleter[];
  userId: string;
}) {
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seenIds.current == null) {
      seenIds.current = new Set(items.map((i) => i.id));
      return;
    }

    for (const item of items) {
      if (seenIds.current.has(item.id)) continue;
      seenIds.current.add(item.id);
      if (item.id.startsWith("optimistic-")) continue;
      if (item.created_by && item.created_by !== userId) {
        const who = item.creator
          ? profileDisplayName(item.creator)
          : "Partner";
        toast.message(`${who} lade till ${item.name}`, {
          duration: 3500,
        });
      }
    }

    // Drop ids that no longer exist (deleted)
    const live = new Set(items.map((i) => i.id));
    for (const id of [...seenIds.current]) {
      if (!live.has(id)) seenIds.current.delete(id);
    }
  }, [items, userId]);

  return null;
}
