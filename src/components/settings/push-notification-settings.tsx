"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/subscribe";
import { toast } from "sonner";

const PREF_KEY = "mati:pushEnabled";

export function PushNotificationSettings({ userId }: { userId: string }) {
  const [mounted, setMounted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSupported(isPushSupported());
    setEnabled(localStorage.getItem(PREF_KEY) === "1");
  }, [userId]);

  if (!mounted) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Notiser</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Laddar…</p>
        </CardContent>
      </Card>
    );
  }

  async function enable() {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      if (!sub) {
        toast.error("Push kunde inte aktiveras");
        return;
      }
      localStorage.setItem(PREF_KEY, "1");
      setEnabled(true);
      toast.success("Push-notiser aktiverade");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fel vid aktivering");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      localStorage.removeItem(PREF_KEY);
      setEnabled(false);
      toast.success("Push-notiser avstängda");
    } catch {
      toast.error("Kunde inte avstänga push");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Notiser</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Push kräver VAPID-nycklar i miljön och en installerad PWA (produktion).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notiser
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Få notis när någon går med, handlar eller lägger till varor.
        </p>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="push-toggle">Push-notiser</Label>
          <span className="text-sm text-muted-foreground">
            {enabled ? "På" : "Av"}
          </span>
        </div>
        {enabled ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={disable}>
            Stäng av push
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={enable}>
            Aktivera push
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
