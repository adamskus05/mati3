import { listSignupRequests } from "@/lib/actions/signup-access";
import { SignupRequestsPanel } from "@/components/admin/signup-requests-panel";
import type { SignupRequestStatus } from "@/lib/database.types";

export default async function AdminSignupRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: raw } = await searchParams;
  const allowed: (SignupRequestStatus | "all")[] = [
    "pending",
    "invited",
    "rejected",
    "approved",
    "all",
  ];
  const filter =
    raw && allowed.includes(raw as SignupRequestStatus | "all")
      ? (raw as SignupRequestStatus | "all")
      : "pending";

  const requests = await listSignupRequests(filter);

  return (
    <div className="space-y-2">
      <h2 className="font-heading text-xl font-semibold">Åtkomstbegäran</h2>
      <p className="text-sm text-muted-foreground">
        Godkänn för att skicka inbjudan via e-post. Användaren sätter lösenord via
        länken.
      </p>
      <SignupRequestsPanel initialRequests={requests} initialFilter={filter} />
    </div>
  );
}
