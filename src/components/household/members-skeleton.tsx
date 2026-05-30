export function MembersSkeleton() {
  return (
    <ul className="animate-pulse space-y-2" aria-hidden>
      {[1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 rounded-2xl border border-border/60 p-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted/60" />
          <div className="h-4 flex-1 rounded bg-muted/60" />
        </li>
      ))}
    </ul>
  );
}
