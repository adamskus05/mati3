import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Action =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

const actionClass =
  "inline-flex h-[var(--mati-touch)] w-full items-center justify-center rounded-xl px-4 text-sm font-medium sm:w-auto sm:min-w-[10rem]";

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  className?: string;
}) {
  function renderAction(action: Action, variant: "default" | "outline") {
    if ("href" in action) {
      return (
        <Link
          key={action.label}
          href={action.href}
          className={cn(buttonVariants({ variant }), actionClass)}
        >
          {action.label}
        </Link>
      );
    }

    return (
      <Button
        key={action.label}
        type="button"
        variant={variant}
        className={actionClass}
        onClick={action.onClick}
      >
        {action.label}
      </Button>
    );
  }

  return (
    <Card className={cn("rounded-2xl border-dashed", className)}>
      <CardContent className="flex flex-col items-center px-4 py-10 text-center">
        {Icon && (
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
          </div>
        )}
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
        {(primaryAction || secondaryAction) && (
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
            {primaryAction && renderAction(primaryAction, "default")}
            {secondaryAction && renderAction(secondaryAction, "outline")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
