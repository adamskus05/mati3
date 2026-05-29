import type { QueryClient, QueryKey } from "@tanstack/react-query";

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function debouncedInvalidate(
  queryClient: QueryClient,
  queryKey: QueryKey,
  delayMs = 350
) {
  const key = JSON.stringify(queryKey);
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void queryClient.invalidateQueries({ queryKey });
    }, delayMs)
  );
}
