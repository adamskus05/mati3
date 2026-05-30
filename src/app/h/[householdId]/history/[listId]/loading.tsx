import { ListItemsSkeleton } from "@/components/items/list-items-skeleton";

export default function HistoryListDetailLoading() {
  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
        <div className="h-5 flex-1 max-w-[10rem] rounded-md bg-muted animate-pulse" />
      </div>
      <ListItemsSkeleton />
    </div>
  );
}
