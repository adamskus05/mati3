"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SettingsView } from "@/components/settings/settings-view";
import { MembersView } from "@/components/household/members-view";
import { HistoryView } from "@/components/lists/history-view";

type SettingsTab = "general" | "members" | "history";

function parseTab(raw: string | null): SettingsTab {
  if (raw === "members") return "members";
  if (raw === "history") return "history";
  return "general";
}

export function SettingsHub({
  householdId,
  userId,
  inviteCode,
  householdName,
  profileName,
  showAdminLink = false,
}: {
  householdId: string;
  userId: string;
  inviteCode: string;
  householdName: string;
  profileName: string;
  showAdminLink?: boolean;
}) {
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const base = `/h/${householdId}/settings`;

  return (
    <div className="space-y-4">
      <div
        className="flex rounded-xl border border-border/60 bg-muted/30 p-1"
        role="tablist"
        aria-label="Inställningar"
      >
        <Link
          href={base}
          scroll={false}
          role="tab"
          aria-selected={tab === "general"}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
            tab === "general"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Allmänt
        </Link>
        <Link
          href={`${base}?tab=members`}
          scroll={false}
          role="tab"
          aria-selected={tab === "members"}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
            tab === "members"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Medlemmar
        </Link>
        <Link
          href={`${base}?tab=history`}
          scroll={false}
          role="tab"
          aria-selected={tab === "history"}
          className={cn(
            "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
            tab === "history"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Historik
        </Link>
      </div>

      {tab === "members" ? (
        <MembersView householdId={householdId} userId={userId} embedded />
      ) : tab === "history" ? (
        <HistoryView householdId={householdId} embedded />
      ) : (
        <SettingsView
          householdId={householdId}
          userId={userId}
          inviteCode={inviteCode}
          householdName={householdName}
          profileName={profileName}
          showAdminLink={showAdminLink}
          embedded
        />
      )}
    </div>
  );
}
