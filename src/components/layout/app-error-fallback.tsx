"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function clearClientCaches() {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // noop: best-effort cleanup only
  }
}

export function AppErrorFallback({
  title = "Något gick fel",
  description = "Ett oväntat fel uppstod i appen.",
  canReset = true,
  onReset,
}: {
  title?: string;
  description?: string;
  canReset?: boolean;
  onReset?: () => void;
}) {
  const [clearing, setClearing] = useState(false);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg items-center justify-center p-6">
      <div className="w-full space-y-4 rounded-2xl border border-border/60 bg-card p-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canReset && (
            <Button
              type="button"
              onClick={() => onReset?.()}
              className="rounded-xl"
            >
              Försök igen
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={clearing}
            onClick={async () => {
              setClearing(true);
              await clearClientCaches();
              window.location.assign(window.location.origin);
            }}
          >
            {clearing ? "Rensar..." : "Rensa app-cache"}
          </Button>
        </div>
      </div>
    </div>
  );
}
