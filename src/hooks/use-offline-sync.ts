"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { flushMutationQueue, queueLength } from "@/lib/offline/mutation-queue";
import { useOnline } from "@/hooks/use-online";
import { toast } from "sonner";

export function useOfflineSync() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    void queueLength().then(setPendingCount);
  }, [online]);

  useEffect(() => {
    if (!online) return;

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const flushed = await flushMutationQueue(supabase, user.id);
      const left = await queueLength();
      setPendingCount(left);

      if (flushed > 0) {
        toast.success(`Synkade ${flushed} offline-ändring${flushed === 1 ? "" : "ar"}`);
        await queryClient.invalidateQueries();
      }
    })();
  }, [online, queryClient]);

  return { online, pendingCount };
}
