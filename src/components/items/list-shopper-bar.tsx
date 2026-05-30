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
  busy,
}: {
  list: ShoppingListWithCreator | null | undefined;
  userId: string;
  onStart: () => void;
  onStop: () => void;
  busy?: boolean;
}) {
  if (!list) return null;

  const active = isShopperActive(list);
  const isMe = list.shopper_id === userId;
  const name = profileDisplayName(list.shopper ?? undefined);

  if (!active) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 rounded-xl"
        onClick={onStart}
        disabled={busy}
      >
        <ShoppingCart className="h-4 w-4" />
        Jag handlar
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
      <Badge variant="secondary" className="gap-1 bg-transparent">
        <ShoppingCart className="h-3.5 w-3.5" />
        {isMe ? "Du handlar" : `${name} handlar`}
      </Badge>
      {isMe && (
        <Button type="button" variant="ghost" size="sm" onClick={onStop} disabled={busy}>
          Sluta handla
        </Button>
      )}
    </div>
  );
}
