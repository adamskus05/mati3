import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types.generated";
import { sendWebPush, type PushPayload } from "@/lib/push/server";

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
    metadata?: Record<string, unknown>;
  };
};

function messageForEventType(eventType: string): { pushType: PushEventType; body: string } | null {
  switch (eventType) {
    case "member_joined":
      return { pushType: "member_joined", body: "Någon gick med i hushållet" };
    case "shopping_started":
      return { pushType: "shopping_started", body: "Någon började handla" };
    case "list_items_added":
      return { pushType: "list_items_added", body: "Nya varor lades till på listan" };
    default:
      return null;
  }
}

function parseSendBody(raw: unknown): SendBody | null {
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
  if (direct.type === "INSERT" && direct.table === "household_events" && record?.household_id) {
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

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key);
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-push-secret");
  if (!secret || secret !== process.env.PUSH_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = parseSendBody(raw);
  if (!body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = adminClient();

  const { data: members, error: membersError } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", body.householdId)
    .returns<{ user_id: string }[]>();

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const userIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== body.excludeUserId);

  if (userIds.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const { data: subs, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", userIds)
    .returns<{ endpoint: string; p256dh: string; auth: string; user_id: string }[]>();

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  const payload: PushPayload = {
    title: body.title,
    body: body.body,
    url: body.url,
  };

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subs ?? []) {
    try {
      await sendWebPush(sub, payload);
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

  return NextResponse.json({ sent, eventType: body.eventType });
}
