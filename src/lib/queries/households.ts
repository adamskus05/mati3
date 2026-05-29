import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Household,
  HouseholdEventWithActor,
  HouseholdMemberRole,
  MemberWithProfile,
} from "@/lib/database.types";
import { isSchemaMissingError, normalizeRole } from "@/lib/household/roles";

type MemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  joined_at: string;
  role?: string | null;
  profiles:
    | { display_name: string | null; email: string }
    | { display_name: string | null; email: string }[]
    | null;
};

function mapMemberRow(row: MemberRow): MemberWithProfile {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    household_id: row.household_id,
    user_id: row.user_id,
    role: normalizeRole(row.role),
    joined_at: row.joined_at,
    profile: (profile ?? { display_name: null, email: "" }) as MemberWithProfile["profile"],
  };
}

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
  const withRole = await supabase
    .from("household_members")
    .select(
      `
      id,
      household_id,
      user_id,
      role,
      joined_at,
      profiles ( display_name, email )
    `
    )
    .eq("household_id", householdId)
    .order("joined_at");

  if (!withRole.error) {
    return (withRole.data ?? []).map((row) => mapMemberRow(row as MemberRow));
  }

  if (!isSchemaMissingError(withRole.error)) {
    throw withRole.error;
  }

  const fallback = await supabase
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

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []).map((row) =>
    mapMemberRow({ ...(row as MemberRow), role: "member" })
  );
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

  if (!error && data) {
    return { role: normalizeRole(data.role) };
  }

  if (error && isSchemaMissingError(error)) {
    return { role: "member" };
  }

  if (error) throw error;
  return null;
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
      profiles ( display_name, email )
    `
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isSchemaMissingError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row) => {
    const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      household_id: row.household_id,
      actor_id: row.actor_id,
      event_type: row.event_type,
      metadata: row.metadata,
      created_at: row.created_at,
      actor: (actor ?? null) as HouseholdEventWithActor["actor"],
    };
  });
}
