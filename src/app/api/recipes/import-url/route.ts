import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Deprecated: recipe import runs on Supabase Edge Function `recipe-import-url`.
 * Kept as auth proxy for clients that still call this route.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "Serverfel" }, { status: 503 });
  }

  const body = await request.text();

  const res = await fetch(`${supabaseUrl}/functions/v1/recipe-import-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
