/**
 * Push notifications – scaffold for future implementation.
 * Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY when enabling.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  // Future: register push subscription with Supabase/backend
  return null;
}
