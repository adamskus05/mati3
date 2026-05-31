"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlatformAdmin } from "@/lib/database.types";
import { addPlatformAdmin, removePlatformAdmin } from "@/lib/actions/signup-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function PlatformAdminsPanel({ admins }: { admins: PlatformAdmin[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await addPlatformAdmin(email);
        toast.success("Administratör tillagd");
        setEmail("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Kunde inte lägga till");
      }
    });
  }

  function onRemove(id: string) {
    startTransition(async () => {
      try {
        await removePlatformAdmin(id);
        toast.success("Administratör borttagen");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Kunde inte ta bort");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Lägg till administratör</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAdd} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="adminEmail">E-post</Label>
              <Input
                id="adminEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@example.com"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Personen får admin-rättigheter när hen loggar in med denna e-post (eller
              redan har konto).
            </p>
            <Button type="submit" size="sm" disabled={pending}>
              Lägg till
            </Button>
          </form>
        </CardContent>
      </Card>

      <ul className="space-y-2">
        {admins.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-xl border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.email}</p>
              <p className="text-xs text-muted-foreground">
                {a.user_id ? "Kopplad till konto" : "Väntar på första inloggning"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending || admins.length <= 1}
              aria-label="Ta bort administratör"
              onClick={() => onRemove(a.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
