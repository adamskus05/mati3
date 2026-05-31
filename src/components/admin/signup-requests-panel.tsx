"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SignupRequest, SignupRequestStatus } from "@/lib/database.types";
import {
  approveSignupRequest,
  rejectSignupRequest,
} from "@/lib/actions/signup-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<SignupRequestStatus, string> = {
  pending: "Väntar",
  approved: "Godkänd",
  rejected: "Avslagen",
  invited: "Inbjuden",
};

type Filter = SignupRequestStatus | "all";

export function SignupRequestsPanel({
  initialRequests,
  initialFilter,
}: {
  initialRequests: SignupRequest[];
  initialFilter: Filter;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, startTransition] = useTransition();

  function refresh(nextFilter: Filter) {
    const q = nextFilter === "all" ? "" : `?status=${nextFilter}`;
    router.push(`/admin/signup-requests${q}`);
  }

  function onApprove(id: string) {
    startTransition(async () => {
      try {
        const result = await approveSignupRequest(id);
        if (result.alreadyRegistered || result.alreadyInvited) {
          toast.message("Användaren har redan konto eller inbjudan");
        } else {
          toast.success("Inbjudan skickad via e-post");
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunde inte godkänna");
      }
    });
  }

  function onReject(id: string) {
    startTransition(async () => {
      try {
        await rejectSignupRequest(id, rejectReason);
        toast.success("Begäran avslagen");
        setRejectId(null);
        setRejectReason("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunde inte avslå");
      }
    });
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "pending", label: "Väntande" },
    { id: "all", label: "Alla" },
    { id: "invited", label: "Inbjudna" },
    { id: "rejected", label: "Avslagna" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setFilter(f.id);
              refresh(f.id);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {initialRequests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga begäran att visa.</p>
      ) : (
        <ul className="space-y-3">
          {initialRequests.map((req) => (
            <li key={req.id}>
              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-medium">
                      {req.display_name}
                    </CardTitle>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {STATUS_LABEL[req.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{req.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.requested_at).toLocaleString("sv-SE")}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {req.message && (
                    <p className="text-sm text-muted-foreground">{req.message}</p>
                  )}
                  {req.rejection_reason && (
                    <p className="text-sm text-destructive">
                      Avslagsorsak: {req.rejection_reason}
                    </p>
                  )}
                  {req.status === "pending" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => onApprove(req.id)}
                      >
                        Godkänn och skicka inbjudan
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          setRejectId(rejectId === req.id ? null : req.id)
                        }
                      >
                        Avslå
                      </Button>
                    </div>
                  )}
                  {rejectId === req.id && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <Label htmlFor={`reason-${req.id}`}>Orsak (valfritt)</Label>
                      <Input
                        id={`reason-${req.id}`}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="T.ex. okänd e-post"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => onReject(req.id)}
                      >
                        Bekräfta avslag
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
