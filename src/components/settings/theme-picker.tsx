"use client";

import { Check } from "lucide-react";
import { useMatiTheme } from "@/hooks/use-mati-theme";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";

export function ThemePicker() {
  const { themeId, setThemeId, themes } = useMatiTheme();
  const { theme, setTheme } = useTheme();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Utseende</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Färgtema</Label>
          <p className="text-xs text-muted-foreground">
            Välj ett personligt tema – sparas på denna enhet.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
                className={cn(
                  "relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all active:scale-[0.98]",
                  themeId === t.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
              >
                <div className="flex w-full gap-1">
                  <span
                    className="h-7 flex-1 rounded-md ring-1 ring-border/50"
                    style={{ backgroundColor: t.preview[1] }}
                    title="Ljust läge"
                  />
                  <span
                    className="h-7 w-8 shrink-0 rounded-md ring-1 ring-border/50"
                    style={{ backgroundColor: t.preview[0] }}
                    title="Accent"
                  />
                  <span
                    className="h-7 flex-1 rounded-md ring-1 ring-border/50"
                    style={{ backgroundColor: t.preview[2] }}
                    title="Mörkt läge"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                {themeId === t.id && (
                  <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ljust / mörkt läge</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "light", label: "Ljust" },
                { id: "dark", label: "Mörkt" },
                { id: "system", label: "Auto" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme(mode.id)}
                className={cn(
                  "rounded-xl border-2 py-2.5 text-sm font-medium transition-all",
                  theme === mode.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-muted/50"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
