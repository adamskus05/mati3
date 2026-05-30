import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type UndoAction = {
  label: string;
  undo: () => void;
};

let pending: UndoAction | null = null;

export function registerUndo(action: UndoAction) {
  pending = action;
  toast.success(action.label, {
    action: {
      label: "Ångra",
      onClick: () => {
        action.undo();
        pending = null;
        toast.success("Ångrat");
      },
    },
    duration: 5000,
  });
}

export function clearUndo() {
  pending = null;
}

export function runUndoWithQuery(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  previous: unknown,
  label: string
) {
  registerUndo({
    label,
    undo: () => {
      queryClient.setQueryData(queryKey, previous);
    },
  });
}
