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

describe.skipIf(!canRun)("recipe RLS (local Supabase)", () => {
  let admin: SupabaseClient<Database>;
  let userA: { id: string; client: SupabaseClient<Database> };
  let userB: { id: string; client: SupabaseClient<Database> };
  let householdAId: string;
  let recipeId: string;

  beforeAll(async () => {
    admin = createClient<Database>(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailA = `rls-recipe-a-${Date.now()}@test.local`;
    const emailB = `rls-recipe-b-${Date.now()}@test.local`;
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
      client: authedClient(signA.data.session.access_token),
    };
    userB = {
      id: createdB.user.id,
      client: authedClient(signB.data.session.access_token),
    };

    const { data: household, error: createErr } = await userA.client.rpc(
      "create_household",
      { p_name: "Recipe RLS Household" }
    );
    if (createErr || !household) throw createErr ?? new Error("create_household");
    householdAId = household.id;

    const { data: recipe, error: recipeErr } = await userA.client
      .from("recipes")
      .insert({
        household_id: householdAId,
        title: "Test recept",
        instructions: ["Steg 1"],
        created_by: userA.id,
      })
      .select()
      .single();
    if (recipeErr || !recipe) throw recipeErr ?? new Error("recipe insert");
    recipeId = recipe.id;

    await userA.client.from("recipe_ingredients").insert({
      recipe_id: recipeId,
      name: "Mjölk",
      sort_order: 0,
    });
  }, 60_000);

  afterAll(async () => {
    if (householdAId) {
      await admin.from("households").delete().eq("id", householdAId);
    }
    if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
    if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
  });

  it("member B cannot read recipes in household A", async () => {
    const { data, error } = await userB.client
      .from("recipes")
      .select("id")
      .eq("id", recipeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("member B cannot read recipe ingredients in household A", async () => {
    const { data, error } = await userB.client
      .from("recipe_ingredients")
      .select("id")
      .eq("recipe_id", recipeId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("member A can read own recipe and ingredients", async () => {
    const { data: recipe, error: rErr } = await userA.client
      .from("recipes")
      .select("title")
      .eq("id", recipeId)
      .single();
    expect(rErr).toBeNull();
    expect(recipe?.title).toBe("Test recept");

    const { data: ings, error: iErr } = await userA.client
      .from("recipe_ingredients")
      .select("name")
      .eq("recipe_id", recipeId);
    expect(iErr).toBeNull();
    expect(ings?.length).toBe(1);
  });
});
