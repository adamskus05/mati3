"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchUserHouseholds } from "@/lib/queries/households";
import { QUERY_KEYS, LAST_HOUSEHOLD_KEY } from "@/lib/constants";
import {
  extractShareUrl,
  isAllowedShareUrl,
} from "@/lib/recipes/extract-share-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function ShareReceiverInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const shareUrl = extractShareUrl(
    searchParams.get("url"),
    searchParams.get("text"),
    searchParams.get("title")
  );

  const { data: households = [], isLoading: householdsLoading } = useQuery({
    queryKey: QUERY_KEYS.households,
    queryFn: () => fetchUserHouseholds(createClient()),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const qs = searchParams.toString();
        const next = qs ? `/share?${qs}` : "/share";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setUserId(user.id);
      setAuthChecked(true);
    })();
  }, [router, searchParams]);

  useEffect(() => {
    if (!authChecked || !shareUrl) return;
    if (!isAllowedShareUrl(shareUrl)) {
      toast.error("Länken kan inte importeras");
      router.replace("/");
      return;
    }
  }, [authChecked, shareUrl, router]);

  useEffect(() => {
    if (!authChecked || !shareUrl || householdsLoading || households.length === 0)
      return;
    const last = localStorage.getItem(LAST_HOUSEHOLD_KEY);
    const validLast = households.find((h) => h.id === last);
    if (validLast) {
      router.replace(
        `/h/${validLast.id}/recipes/new?importUrl=${encodeURIComponent(shareUrl)}`
      );
      return;
    }
    if (households.length === 1) {
      router.replace(
        `/h/${households[0].id}/recipes/new?importUrl=${encodeURIComponent(shareUrl)}`
      );
    }
  }, [
    authChecked,
    shareUrl,
    households,
    householdsLoading,
    router,
  ]);

  if (!authChecked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!shareUrl) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Ingen länk hittades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dela en receptlänk från webbläsaren till Mati för att importera.
            </p>
            <Button variant="outline" onClick={() => router.push("/")}>
              Till startsidan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (householdsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (households.length === 0) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Skapa ett hushåll först</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")}>Gå till startsidan</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (households.length > 1) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-lg font-semibold">Välj hushåll</h1>
        <p className="text-sm text-muted-foreground">
          Importera recept till vilket hushåll?
        </p>
        <ul className="space-y-2">
          {households.map((h) => (
            <li key={h.id}>
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => {
                  localStorage.setItem(LAST_HOUSEHOLD_KEY, h.id);
                  router.replace(
                    `/h/${h.id}/recipes/new?importUrl=${encodeURIComponent(shareUrl)}`
                  );
                }}
              >
                {h.name}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ShareReceiverInner />
    </Suspense>
  );
}
