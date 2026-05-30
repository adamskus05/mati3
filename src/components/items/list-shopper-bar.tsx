"use client";

import { ShoppingCart } from "lucide-react";
import { profileDisplayName } from "@/lib/profiles/display-name";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ShoppingListWithCreator } from "@/lib/database.types";

const SHOPPER_STALE_MS = 4 * 60 * 60 * 1000;

export function isShopperActive(list: ShoppingListWithCreator | null | undefined) {
  if (!list?.shopper_id || !list.shopper_started_at) return false;
  return Date.now() - new Date(list.shopper_started_at).getTime() < SHOPPER_STALE_MS;
}

export function ListShopperBar({
  list,
  userId,
  onStart,
  onStop,
}: {
  list: ShoppingListWithCreator | null | undefined;
  userId: string;
  onStart: () => void;
  onStop: () => void;
}) {
  if (!list) return null;

  const active = isShopperActive(list);
  const isMe = list.shopper_id === userId;
  const name = profileDisplayName(list.shopper ?? undefined);

  if (!active) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 shrink-0 gap-1 rounded-lg px-2 text-xs text-muted-foreground"
        onClick={onStart}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        Handla
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2 py-1">
      <Badge
        variant="secondary"
        className="h-6 max-w-[10rem] gap-1 truncate border-0 bg-transparent px-0 text-[11px] font-medium"
      >
        <ShoppingCart className="h-3 w-3 shrink-0" />
        <span className="truncate">{isMe ? "Du handlar" : `${name} handlar`}</span>
      </Badge>
      {isMe && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 px-2 text-[11px]"
          onClick={onStop}
        >
          Sluta
        </Button>
      )}
    </div>
  );
}
