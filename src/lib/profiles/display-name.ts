/** Label for a profile in the UI (never empty when email exists). */
export function profileDisplayName(
  profile: { display_name?: string | null; email?: string | null } | null | undefined
): string {
  if (!profile) return "Okänd";
  const name = profile.display_name?.trim();
  if (name) return name;
  const email = profile.email?.trim();
  if (email) return email.split("@")[0] ?? email;
  return "Okänd";
}
