/** Show loading UI only when there is no cached/persisted data yet. */
export function showQueryLoading(
  isLoading: boolean,
  data: unknown[] | undefined | null
): boolean {
  return isLoading && !(data && data.length > 0);
}
