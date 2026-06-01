import { NextResponse } from "next/server";

/**
 * Deprecated: push delivery runs on Supabase Edge Function `push-send`.
 * Configure the database webhook to POST to:
 * `{SUPABASE_URL}/functions/v1/push-send` with header `x-push-secret`.
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.PUSH_WEBHOOK_SECRET;

  if (!supabaseUrl || !secret) {
    return NextResponse.json(
      { error: "Push proxy not configured" },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/push-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-push-secret": secret,
    },
    body: JSON.stringify(raw),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
