import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard title="Välkommen tillbaka" description="Logga in på ditt Mati-konto">
      <LoginForm />
    </AuthCard>
  );
}
