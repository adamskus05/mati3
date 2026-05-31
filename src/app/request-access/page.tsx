import { AuthCard } from "@/components/auth/auth-card";
import { RequestAccessForm } from "@/components/auth/request-access-form";

export default function RequestAccessPage() {
  return (
    <AuthCard
      title="Begär åtkomst"
      description="Mati är inbjudningsbaserat. Skicka en begäran så godkänner en administratör den."
    >
      <RequestAccessForm />
    </AuthCard>
  );
}
