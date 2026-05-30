import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types.generated";

const url =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey =
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const canRun =
  Boolean(url && anonKey && serviceKey) &&
  (url.includes("127.0.0.1") || url.includes("localhost"));

function authedClient(accessToken: string) {
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

describe.skipIf(!canRun)("household RLS (local Supabase)", () => {
  let admin: SupabaseClient<Database>;
  let userA: { id: string; email: string; client: SupabaseClient<Database> };
  let userB: { id: string; email: string; client: SupabaseClient<Database> };
  let householdAId: string;
  let inviteCode: string;

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailA = `rls-a-${Date.now()}@test.local`;
    const emailB = `rls-b-${Date.now()}@test.local`;
    const password = "test-password-12345!";

    const { data: createdA, error: errA } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    const { data: createdB, error: errB } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (errA || errB || !createdA.user || !createdB.user) {
      throw new Error(errA?.message ?? errB?.message ?? "createUser failed");
    }

    const signA = await admin.auth.signInWithPassword({ email: emailA, password });
    const signB = await admin.auth.signInWithPassword({ email: emailB, password });
    if (!signA.data.session || !signB.data.session) {
      throw new Error("signIn failed");
    }

    userA = {
      id: createdA.user.id,
      email: emailA,
      client: authedClient(signA.data.session.access_token),
    };
    userB = {
      id: createdB.user.id,
      email: emailB,
      client: authedClient(signB.data.session.access_token),
    };

    const { data: household, error: createErr } = await userA.client.rpc(
      "create_household",
      { p_name: "RLS Test Household" }
    );
    if (createErr || !household) throw createErr ?? new Error("create_household");
    householdAId = household.id;
    inviteCode = household.invite_code;
  }, 60_000);

  afterAll(async () => {
    if (householdAId) {
      await admin.from("households").delete().eq("id", householdAId);
    }
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
  });

  it("member B cannot read household A before joining", async () => {
    const { data, error } = await userB.client
      .from("households")
      .select("id")
      .eq("id", householdAId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("member B can read peer profile after joining", async () => {
    const { error: joinErr } = await userB.client.rpc("join_household_by_code", {
      p_code: inviteCode,
    });
    expect(joinErr).toBeNull();

    const { data: profile, error } = await userB.client
      .from("profiles")
      .select("display_name, email")
      .eq("id", userA.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(profile?.email).toBe(userA.email);
  });

  it("non-owner cannot renew invite code", async () => {
    const { error } = await userB.client.rpc("renew_household_invite_code", {
      p_household_id: householdAId,
    });
    expect(error).not.toBeNull();
  });

  it("owner can renew invite code", async () => {
    const { data, error } = await userA.client.rpc("renew_household_invite_code", {
      p_household_id: householdAId,
    });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
  });
});

describe.skipIf(!canRun)("join rate limit", () => {
  it("blocks excessive join attempts", async () => {
    const admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = `rls-rate-${Date.now()}@test.local`;
    const password = "test-password-12345!";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createErr).toBeNull();
    const sign = await admin.auth.signInWithPassword({ email, password });
    const client = authedClient(sign.data.session!.access_token);

    let lastError: { message: string } | null = null;
    for (let i = 0; i < 12; i++) {
      const { error } = await client.rpc("join_household_by_code", {
        p_code: "INVALID1",
      });
      if (error) lastError = error;
    }

    expect(lastError?.message).toMatch(/För många försök/i);

    if (created?.user?.id) await admin.auth.admin.deleteUser(created.user.id);
  });
});
