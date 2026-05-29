import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthCard title="Skapa konto" description="Börja planera inköp tillsammans">
      <RegisterForm />
    </AuthCard>
  );
}
