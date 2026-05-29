import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Household,
  HouseholdEventWithActor,
  HouseholdMemberRole,
  MemberWithProfile,
} from "@/lib/database.types";

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
      role,
      joined_at,
      profiles!household_members_user_id_fkey ( display_name, email )
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
      role: row.role as HouseholdMemberRole,
      joined_at: row.joined_at,
      profile: profile as MemberWithProfile["profile"],
    };
  });
}

export async function fetchMyMembership(
  supabase: SupabaseClient,
  householdId: string,
  userId: string
): Promise<{ role: HouseholdMemberRole } | null> {
  const { data, error } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { role: data.role as HouseholdMemberRole };
}

export async function fetchHouseholdEvents(
  supabase: SupabaseClient,
  householdId: string,
  limit = 50
): Promise<HouseholdEventWithActor[]> {
  const { data, error } = await supabase
    .from("household_events")
    .select(
      `
      id,
      household_id,
      actor_id,
      event_type,
      metadata,
      created_at,
      profiles!household_events_actor_id_fkey ( display_name, email )
    `
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      household_id: row.household_id,
      actor_id: row.actor_id,
      event_type: row.event_type,
      metadata: row.metadata,
      created_at: row.created_at,
      actor: actor as HouseholdEventWithActor["actor"],
    };
  });
}
