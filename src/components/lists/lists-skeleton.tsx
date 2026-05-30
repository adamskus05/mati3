export function ListsSkeleton() {
  return (
    <ul className="space-y-2 animate-pulse" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <li key={i} className="h-[3.25rem] rounded-2xl bg-muted/60" />
      ))}
    </ul>
  );
}
