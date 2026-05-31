import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) {
    const service = createServiceClient();
    const { data: row } = await service
      .from("platform_admins")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return Boolean(row);
  }
  return Boolean(data);
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
  const ok = await isPlatformAdmin(user.id);
  if (!ok) {
    throw new Error("Forbidden");
  }
  return { userId: user.id, email: user.email };
}
