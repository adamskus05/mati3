import { createClient } from "@/lib/supabase/client";

export type PartnerPushPayload = {
  householdId: string;
  eventType: "list_items_added" | "shopping_started" | "shopping_ended";
  body: string;
  url?: string;
  title?: string;
};

/** Fire-and-forget push to other household members (Edge push-send + user JWT). */
export function notifyPartnerPush(payload: PartnerPushPayload): void {
  void (async () => {
    try {
      const supabase = createClient();
      await supabase.functions.invoke("push-send", {
        body: {
          householdId: payload.householdId,
          eventType: payload.eventType,
          title: payload.title ?? "Mati",
          body: payload.body,
          url: payload.url ?? `/h/${payload.householdId}`,
        },
      });
    } catch {
      // Push is best-effort; never block list actions
    }
  })();
}
