import type { SupabaseClient } from "@supabase/supabase-js";
import type { Household, MemberWithProfile } from "@/lib/database.types";

export async function fetchUserHouseholds(
  supabase: SupabaseClient
): Promise<Household[]> {
  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id");

  if (!memberships?.length) return [];

  const ids = memberships.map((m) => m.household_id);
  const { data, error } = await supabase
    .from("households")
    .select("*")
    .in("id", ids)
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchHousehold(
  supabase: SupabaseClient,
  id: string
): Promise<Household | null> {
  const { data, error } = await supabase
    .from("households")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function fetchMembers(
  supabase: SupabaseClient,
  householdId: string
): Promise<MemberWithProfile[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select(
      `
      id,
      household_id,
      user_id,
      joined_at,
      profiles ( display_name, email )
    `
    )
    .eq("household_id", householdId)
    .order("joined_at");

  if (error) throw error;

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      household_id: row.household_id,
      user_id: row.user_id,
      joined_at: row.joined_at,
      profile: profile as MemberWithProfile["profile"],
    };
  });
}
