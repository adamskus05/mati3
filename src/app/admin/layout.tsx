import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { cn } from "@/lib/utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = await isPlatformAdmin(user.id);
  if (!admin) {
    redirect("/");
  }

  const nav = [
    { href: "/admin/signup-requests", label: "Åtkomstbegäran" },
    { href: "/admin/admins", label: "Administratörer" },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60 bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-primary">Mati Admin</p>
              <h1 className="font-heading text-lg font-semibold">Plattform</h1>
            </div>
            <Link href="/" className="text-sm text-muted-foreground underline">
              Till appen
            </Link>
          </div>
          <nav className="flex gap-2">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
