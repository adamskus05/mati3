import { cn } from "@/lib/utils";

export function ListItemsSkeleton({ compact = false }: { compact?: boolean }) {
  const rowClass = compact
    ? "h-9 rounded-lg bg-muted/60"
    : "h-9 rounded-lg bg-muted/60";

  return (
    <div
      className={cn("animate-pulse", compact ? "space-y-2" : "space-y-3")}
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
