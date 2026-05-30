/** True when running as installed PWA (home screen). */
export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}
