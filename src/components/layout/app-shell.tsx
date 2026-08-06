"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Settings, LogOut, ChefHat, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { HouseholdSwitcher } from "@/components/household/household-switcher";
import { useLockedSafeArea } from "@/hooks/use-locked-safe-area";
import { prefetchHouseholdTabs } from "@/lib/query/prefetch-household-tabs";
import { isStandalonePwa } from "@/lib/pwa/standalone";
import { GlobalSearchSheet } from "@/components/search/global-search-sheet";

const navItems = (householdId: string) =>
  [
    { id: "lists" as const, href: `/h/${householdId}`, label: "Listor", icon: Home },
    {
      id: "recipes" as const,
      href: `/h/${householdId}/recipes`,
      label: "Recept",
      icon: ChefHat,
    },
    {
      id: "settings" as const,
      href: `/h/${householdId}/settings`,
      label: "Inställningar",
      icon: Settings,
    },
  ] as const;

function isNavActive(
  id: "lists" | "recipes" | "settings",
  householdId: string,
  pathname: string
): boolean {
  const base = `/h/${householdId}`;
  if (id === "lists") {
    if (pathname === base) return true;
    if (pathname.startsWith(`${base}/lists/`)) return true;
    return false;
  }
  if (id === "recipes") {
    return pathname.startsWith(`${base}/recipes`);
  }
  if (pathname.startsWith(`${base}/settings`)) return true;
  if (pathname.startsWith(`${base}/history/`)) return true;
  return false;
}

function NavLinks({
  householdId,
  pathname,
  pendingHref,
  onNavigate,
  variant,
}: {
  householdId: string;
  pathname: string;
  pendingHref: string | null;
  onNavigate: (href: string) => void;
  variant: "bottom" | "side";
}) {
  const items = navItems(householdId);

  return items.map(({ id, href, label, icon: Icon }) => {
    const active =
      pendingHref === href ||
      (pendingHref === null && isNavActive(id, householdId, pathname));

    if (variant === "side") {
      return (
        <Link
          key={href}
          href={href}
          prefetch
          scroll={false}
          onClick={() => onNavigate(href)}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 active:scale-[0.98]",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </Link>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        prefetch
        scroll={false}
        onClick={() => onNavigate(href)}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-[var(--mati-nav-bar-content)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] leading-none transition-opacity duration-150 active:opacity-70",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span className="max-w-full truncate px-0.5">{label}</span>
      </Link>
    );
  });
}

export function AppShell({
  householdId,
  householdName,
  children,
}: {
  householdId: string;
  householdName: string;
  children: React.ReactNode;
}) {
  useLockedSafeArea();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    for (const { href } of navItems(householdId)) {
      router.prefetch(href);
    }

    if (isStandalonePwa()) return;

    const runPrefetch = () => prefetchHouseholdTabs(queryClient, householdId);
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(runPrefetch, { timeout: 5000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(runPrefetch, 0);
    return () => window.clearTimeout(t);
  }, [householdId, router, queryClient]);

  return (
    <div className="app-shell bg-background">
      <aside className="app-side-nav" aria-label="Huvudnavigering">
        <div className="mb-4 px-1">
          <p className="text-xs font-medium text-primary">Mati</p>
          <p className="truncate font-heading text-base font-semibold">{householdName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          <NavLinks
            householdId={householdId}
            pathname={pathname}
            pendingHref={pendingHref}
            onNavigate={setPendingHref}
            variant="side"
          />
        </nav>
        <div className="mt-auto space-y-1 border-t border-border/50 pt-3">
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-start gap-3 rounded-xl px-3"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            Sök
          </Button>
          <div className="flex items-center gap-1 px-1">
            <ThemeToggle />
            <form action={signOut} className="flex-1">
              <Button
                type="submit"
                variant="ghost"
                className="h-10 w-full justify-start gap-3 rounded-xl px-3"
              >
                <LogOut className="h-4 w-4" />
                Logga ut
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="app-shell__column min-w-0 flex-1">
        <OfflineBanner />
        <header className="sticky top-0 z-40 shrink-0 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <div className="mati-content mx-auto flex w-full items-center justify-between mati-page-x py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">Mati</p>
              <HouseholdSwitcher
                currentHouseholdId={householdId}
                currentName={householdName}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Sök"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <ThemeToggle />
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="icon" aria-label="Logga ut">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </header>

        <header className="sticky top-0 z-40 hidden shrink-0 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:block">
          <div className="mati-content mx-auto flex w-full items-center justify-between mati-page-x py-3">
            <HouseholdSwitcher
              currentHouseholdId={householdId}
              currentName={householdName}
            />
          </div>
        </header>

        <main className="app-main-scroll mati-content mx-auto mati-page-x py-4 lg:py-6">
          {children}
        </main>
      </div>

      <GlobalSearchSheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        householdId={householdId}
      />

      <nav className="app-bottom-nav" aria-label="Huvudnavigering">
        <div className="app-bottom-nav__bar mati-content mx-auto flex w-full items-stretch justify-around px-1">
          <NavLinks
            householdId={householdId}
            pathname={pathname}
            pendingHref={pendingHref}
            onNavigate={setPendingHref}
            variant="bottom"
          />
        </div>
      </nav>
    </div>
  );
}
