import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Återställ lösenord" description="Vi skickar en länk till din e-post">
      <ResetForm />
    </AuthCard>
  );
}
