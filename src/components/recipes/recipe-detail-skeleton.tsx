export function RecipeDetailSkeleton() {
  return (
    <div className="space-y-4 pb-6 animate-pulse" aria-hidden>
      <div className="flex items-start gap-2">
        <div className="h-9 w-9 shrink-0 rounded-md bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-7 max-w-[14rem] rounded-md bg-muted" />
          <div className="h-4 w-24 rounded-md bg-muted/70" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-[var(--mati-touch)] flex-1 rounded-xl bg-muted/60" />
        <div className="h-[var(--mati-touch)] flex-1 rounded-xl bg-muted/60" />
        <div className="h-[var(--mati-touch)] w-12 rounded-xl bg-muted/60" />
      </div>
      <div className="h-48 rounded-2xl bg-muted/60" />
      <div className="h-40 rounded-2xl bg-muted/60" />
    </div>
  );
}
