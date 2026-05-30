export function ListItemsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      {[1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <div className="h-4 w-24 rounded-md bg-muted" />
          <div className="space-y-2">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex h-12 items-center gap-2 rounded-xl bg-muted/60 px-3"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
