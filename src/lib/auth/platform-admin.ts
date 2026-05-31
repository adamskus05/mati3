import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * True if user is a platform admin. Links user_id on first check when only email was seeded.
 */
export async function isPlatformAdmin(
  userId: string,
  email?: string | null
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (!error && data) return true;

  const service = createServiceClient();

  const { data: byUserId } = await service
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (byUserId) return true;

  if (!email) return false;

  const { data: byEmail } = await service
    .from("platform_admins")
    .select("id, user_id")
    .eq("email", normalizeAdminEmail(email))
    .maybeSingle();

  if (!byEmail) return false;

  if (!byEmail.user_id) {
    await service
      .from("platform_admins")
      .update({ user_id: userId })
      .eq("id", byEmail.id);
  }

  return true;
}

export async function requirePlatformAdmin(): Promise<{
  userId: string;
  email: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    throw new Error("Ej inloggad");
  }
  const ok = await isPlatformAdmin(user.id, user.email);
  if (!ok) {
    throw new Error("Forbidden");
  }
  return { userId: user.id, email: user.email };
}
