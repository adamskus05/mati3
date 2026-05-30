export function ListItemsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      {[1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <div className="h-5 w-20 rounded-full bg-muted" />
          <div className="space-y-1">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="h-[var(--mati-touch)] rounded-xl bg-muted/60"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
