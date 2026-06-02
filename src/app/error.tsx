"use client";

import { useEffect } from "react";
import { AppErrorFallback } from "@/components/layout/app-error-fallback";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <AppErrorFallback
      title="Appen fick ett fel"
      description="Du kan prova igen direkt. Om felet kvarstår, rensa app-cache och ladda om."
      onReset={reset}
    />
  );
}
