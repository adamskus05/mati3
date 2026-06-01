"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DuplicateItemDialog({
  open,
  itemName,
  existingName,
  canMerge,
  onOpenChange,
  onAddAnyway,
  onMerge,
}: {
  open: boolean;
  itemName: string;
  existingName: string;
  canMerge: boolean;
  onOpenChange: (open: boolean) => void;
  onAddAnyway: () => void;
  onMerge: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finns redan på listan</DialogTitle>
          <DialogDescription>
            «{itemName}» liknar «{existingName}» som redan finns (ej avbockad).
            {canMerge
              ? " Du kan slå ihop mängder om enheterna matchar."
              : " Olika enheter – lägg till som separat rad om du vill."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {canMerge && (
            <Button type="button" className="w-full" onClick={onMerge}>
              Slå ihop
            </Button>
          )}
          <Button
            type="button"
            variant={canMerge ? "outline" : "default"}
            className="w-full"
            onClick={onAddAnyway}
          >
            Lägg till ändå
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Avbryt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
