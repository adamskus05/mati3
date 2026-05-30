export function TabPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-7 w-32 rounded-md bg-muted" />
      <ul className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="h-12 rounded-2xl bg-muted/60" />
        ))}
      </ul>
    </div>
  );
}
