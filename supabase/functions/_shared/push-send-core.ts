import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushEventType = "member_joined" | "list_items_added" | "shopping_started";

type SendBody = {
  householdId: string;
  eventType: PushEventType;
  title: string;
  body: string;
  url?: string;
  excludeUserId?: string;
};

type SupabaseWebhookPayload = {
  type?: string;
  table?: string;
  record?: {
    household_id?: string;
    actor_id?: string | null;
    event_type?: string;
  };
};

function messageForEventType(
  eventType: string
): { pushType: PushEventType; body: string } | null {
  switch (eventType) {
    case "member_joined":
      return { pushType: "member_joined", body: "Någon gick med i hushållet" };
    case "shopping_started":
      return { pushType: "shopping_started", body: "Någon började handla" };
    case "list_items_added":
      return {
        pushType: "list_items_added",
        body: "Nya varor lades till på listan",
      };
    default:
      return null;
  }
}

export function parseSendBody(raw: unknown): SendBody | null {
  if (!raw || typeof raw !== "object") return null;

  const direct = raw as Partial<SendBody> & SupabaseWebhookPayload;
  if (direct.householdId && direct.title && direct.body) {
    return {
      householdId: direct.householdId,
      eventType: (direct.eventType ?? "member_joined") as PushEventType,
      title: direct.title,
      body: direct.body,
      url: direct.url,
      excludeUserId: direct.excludeUserId,
    };
  }

  const record = direct.record;
  if (
    direct.type === "INSERT" &&
    direct.table === "household_events" &&
    record?.household_id
  ) {
    const mapped = messageForEventType(record.event_type ?? "");
    if (!mapped) return null;

    return {
      householdId: record.household_id,
      eventType: mapped.pushType,
      title: "Mati",
      body: mapped.body,
      url: `/h/${record.household_id}`,
      excludeUserId: record.actor_id ?? undefined,
    };
  }

  return null;
}

function configureWebPush() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ??
    Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails("mailto:support@mati.app", publicKey, privateKey);
  return webpush;
}

export async function runPushSend(raw: unknown): Promise<Response> {
  const body = parseSendBody(raw);
  if (!body) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", body.householdId);

  if (membersError) {
    return new Response(JSON.stringify({ error: membersError.message }), {
      status: 500,
    });
  }

  const userIds = (members ?? [])
    .map((m: { user_id: string }) => m.user_id)
    .filter((id: string) => id !== body.excludeUserId);

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", userIds);

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), {
      status: 500,
    });
  }

  const wp = configureWebPush();
  const payload = JSON.stringify({
    title: body.title,
    body: body.body,
    url: body.url,
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subs ?? []) {
    try {
      await wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? (err as { statusCode: number }).statusCode
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }

  return new Response(
    JSON.stringify({ sent, eventType: body.eventType }),
    { headers: { "Content-Type": "application/json" } }
  );
}
