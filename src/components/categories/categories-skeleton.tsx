export function CategoriesSkeleton() {
  return (
    <ul className="animate-pulse space-y-0 overflow-hidden rounded-2xl border border-border/60" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="h-12 border-b border-border/40 bg-muted/40 last:border-b-0" />
      ))}
    </ul>
  );
}
