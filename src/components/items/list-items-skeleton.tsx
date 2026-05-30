import { cn } from "@/lib/utils";

export function ListItemsSkeleton({ compact = false }: { compact?: boolean }) {
  const rowClass = compact
    ? "h-10 rounded-xl bg-muted/60"
    : "h-[var(--mati-touch)] rounded-xl bg-muted/60";

  return (
    <div
      className={cn("animate-pulse", compact ? "space-y-3" : "space-y-4")}
      aria-hidden
    >
      {[1, 2].map((section) => (
        <div key={section} className={compact ? "space-y-1" : "space-y-2"}>
          <div
            className={cn(
              "rounded-full bg-muted",
              compact ? "h-4 w-16" : "h-5 w-20"
            )}
          />
          <div className="space-y-1">
            {[1, 2, 3].map((row) => (
              <div key={row} className={rowClass} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
