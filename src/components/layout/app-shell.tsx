"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Tags,
  Users,
  Settings,
  History,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navItems = (householdId: string) => [
  { href: `/h/${householdId}`, label: "Listor", icon: Home },
  { href: `/h/${householdId}/categories`, label: "Kategorier", icon: Tags },
  { href: `/h/${householdId}/members`, label: "Medlemmar", icon: Users },
  { href: `/h/${householdId}/history`, label: "Historik", icon: History },
  { href: `/h/${householdId}/settings`, label: "Inställningar", icon: Settings },
];

export function AppShell({
  householdId,
  householdName,
  children,
}: {
  householdId: string;
  householdName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = navItems(householdId);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div>
            <Link href={`/h/${householdId}`} className="font-heading text-lg font-semibold">
              Mati
            </Link>
            <p className="text-xs text-muted-foreground">{householdName}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Logga ut">
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-md safe-area-pb">
        <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active =
              href === `/h/${householdId}`
                ? pathname === href || pathname.includes("/lists/")
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
