import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type PushEventType =
  | "member_joined"
  | "list_items_added"
  | "shopping_started"
  | "shopping_ended";

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
    metadata?: Record<string, unknown> | null;
  };
};

function messageForEventType(
  eventType: string,
  _metadata?: Record<string, unknown> | null
): { pushType: PushEventType; body: string; urlSuffix?: string } | null {
  switch (eventType) {
    case "member_joined":
      return { pushType: "member_joined", body: "Någon gick med i hushållet" };
    // shopping_* and list_items_added are sent from the app (authenticated
    // push-send) with richer copy — skip webhook to avoid duplicate notifies.
    default:
      return null;
  }
}

export function parseSendBody(raw: unknown): SendBody | { skipped: true } | null {
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
    const mapped = messageForEventType(
      record.event_type ?? "",
      record.metadata
    );
    if (!mapped) {
      // Ignore non-push events so Database Webhooks don't retry as errors
      return { skipped: true };
    }

    return {
      householdId: record.household_id,
      eventType: mapped.pushType,
      title: "Mati",
      body: mapped.body,
      url: `/h/${record.household_id}${mapped.urlSuffix ?? ""}`,
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
  const parsed = parseSendBody(raw);
  if (!parsed) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if ("skipped" in parsed) {
    return new Response(JSON.stringify({ sent: 0, skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const body = parsed;

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
    return new Response(JSON.stringify({ sent: 0, eventType: body.eventType }), {
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
