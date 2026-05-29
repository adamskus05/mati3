import type { HouseholdMemberRole } from "@/lib/database.types";

export function normalizeRole(role: string | null | undefined): HouseholdMemberRole {
  return role === "owner" ? "owner" : "member";
}

export function roleLabel(role: string | null | undefined): string {
  return normalizeRole(role) === "owner" ? "Ägare" : "Medlem";
}

/** Supabase/PostgREST errors when migrations are not applied yet. */
export function isSchemaMissingError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    code === "PGRST200" ||
    code === "PGRST205" ||
    msg.includes("household_events") ||
    msg.includes("column") ||
    msg.includes("relationship") ||
    msg.includes("does not exist")
  );
}
