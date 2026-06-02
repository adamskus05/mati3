"use client";

import { AppErrorFallback } from "@/components/layout/app-error-fallback";

export default function GlobalError() {
  return (
    <html lang="sv">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <AppErrorFallback
          title="Kritiskt appfel"
          description="Sidan kunde inte renderas korrekt. Rensa app-cache och ladda om."
          canReset={false}
        />
      </body>
    </html>
  );
}
