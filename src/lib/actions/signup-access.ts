"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { getSiteOrigin } from "@/lib/site-url";
import { requestAccessSchema } from "@/lib/validators/auth";
import type { SignupRequestStatus } from "@/lib/database.types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return Boolean(profile);
}

export async function submitSignupRequest(input: {
  email: string;
  displayName: string;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = requestAccessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter" };
  }

  const email = normalizeEmail(parsed.data.email);
  const displayName = parsed.data.displayName.trim();
  const message = parsed.data.message?.trim() || null;

  try {
    const admin = createServiceClient();

    if (await emailAlreadyRegistered(email)) {
      return {
        ok: false,
        error: "Det finns redan ett konto med den här e-postadressen. Logga in i stället.",
      };
    }

    const { data: pending } = await admin
      .from("signup_requests")
      .select("id")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (pending) {
      return {
        ok: false,
        error: "Det finns redan en väntande begäran för den här e-postadressen.",
      };
    }

    const { error } = await admin.from("signup_requests").insert({
      email,
      display_name: displayName,
      message,
      status: "pending",
    });

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Det finns redan en väntande begäran för den här e-postadressen.",
        };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Kunde inte skicka begäran",
    };
  }
}

export async function listSignupRequests(
  status?: SignupRequestStatus | "all"
) {
  await requirePlatformAdmin();
  const admin = createServiceClient();
  let query = admin
    .from("signup_requests")
    .select("*")
    .order("requested_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function approveSignupRequest(requestId: string) {
  const { userId } = await requirePlatformAdmin();
  const admin = createServiceClient();

  const { data: request, error: fetchError } = await admin
    .from("signup_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    throw new Error("Begäran hittades inte");
  }

  if (request.status === "invited") {
    return { ok: true as const, alreadyInvited: true };
  }

  if (request.status !== "pending" && request.status !== "approved") {
    throw new Error("Begäran kan inte godkännas i det här läget");
  }

  const origin = await getSiteOrigin();

  if (await emailAlreadyRegistered(request.email)) {
    await admin
      .from("signup_requests")
      .update({
        status: "invited",
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq("id", requestId);
    revalidatePath("/admin/signup-requests");
    return { ok: true as const, alreadyRegistered: true };
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    request.email,
    {
      data: { display_name: request.display_name },
      redirectTo: `${origin}/auth/callback`,
    }
  );

  if (inviteError) {
    const msg = inviteError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      await admin
        .from("signup_requests")
        .update({
          status: "invited",
          reviewed_at: new Date().toISOString(),
          reviewed_by: userId,
        })
        .eq("id", requestId);
      revalidatePath("/admin/signup-requests");
      return { ok: true as const, alreadyRegistered: true };
    }
    throw new Error(inviteError.message);
  }

  const { error: updateError } = await admin
    .from("signup_requests")
    .update({
      status: "invited",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq("id", requestId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/signup-requests");
  return { ok: true as const };
}

export async function rejectSignupRequest(
  requestId: string,
  rejectionReason?: string
) {
  const { userId } = await requirePlatformAdmin();
  const admin = createServiceClient();

  const { error } = await admin
    .from("signup_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      rejection_reason: rejectionReason?.trim() || null,
    })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
  revalidatePath("/admin/signup-requests");
}

export async function listPlatformAdmins() {
  await requirePlatformAdmin();
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("platform_admins")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addPlatformAdmin(email: string) {
  const { userId } = await requirePlatformAdmin();
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    throw new Error("Ogiltig e-postadress");
  }

  const admin = createServiceClient();
  const { error } = await admin.from("platform_admins").insert({
    email: normalized,
    created_by: userId,
  });

  if (error) {
    if (error.code === "23505") throw new Error("E-postadressen är redan admin");
    throw new Error(error.message);
  }

  revalidatePath("/admin/admins");
}

export async function removePlatformAdmin(adminId: string) {
  await requirePlatformAdmin();
  const admin = createServiceClient();

  const { count, error: countError } = await admin
    .from("platform_admins")
    .select("id", { count: "exact", head: true });

  if (countError) throw new Error(countError.message);
  if ((count ?? 0) <= 1) {
    throw new Error("Kan inte ta bort den sista plattformsadministratören");
  }

  const { error } = await admin.from("platform_admins").delete().eq("id", adminId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/admins");
}

export async function checkIsPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc("is_platform_admin");
  return Boolean(data);
}
