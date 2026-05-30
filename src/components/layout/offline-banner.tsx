"use client";

import { useOfflineSync } from "@/hooks/use-offline-sync";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const { online, pendingCount } = useOfflineSync();

  if (online && pendingCount === 0) return null;

  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 mati-page-x py-2 text-center text-xs text-amber-900 dark:text-amber-100"
      role="status"
    >
      <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
      {!online
        ? `Offline${pendingCount > 0 ? ` · ${pendingCount} ändring${pendingCount === 1 ? "" : "ar"} väntar` : ""}`
        : `Synkar ${pendingCount} offline-ändring${pendingCount === 1 ? "" : "ar"}…`}
    </div>
  );
}
