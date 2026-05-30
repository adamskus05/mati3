export function RecipeEditorSkeleton() {
  return (
    <div className="space-y-4 pb-6 animate-pulse" aria-hidden>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 shrink-0 rounded-md bg-muted" />
        <div className="h-7 w-32 rounded-md bg-muted" />
      </div>
      <div className="h-10 rounded-xl bg-muted/60" />
      <div className="h-24 rounded-xl bg-muted/60" />
      <div className="h-32 rounded-xl bg-muted/60" />
      <div className="h-40 rounded-xl bg-muted/60" />
      <div className="h-10 rounded-xl bg-primary/20" />
    </div>
  );
}
