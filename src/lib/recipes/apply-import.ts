import { formatInstructionSteps } from "@/lib/recipes/instruction-format";

export type ImportedRecipePayload = {
  error?: string;
  title?: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  ingredients?: {
    name: string;
    quantity?: number | null;
    unit?: string | null;
    section?: string | null;
  }[];
  instructions?: string[];
};

export type AppliedImport = {
  title: string;
  sourceUrl: string;
  imageUrl: string | null;
  ingredients: {
    key: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    notes: string | null;
    section: string | null;
  }[];
  instructionsText: string;
};

export function applyImportedRecipe(
  payload: ImportedRecipePayload,
  fallbackSourceUrl = ""
): AppliedImport {
  const ings = payload.ingredients ?? [];
  return {
    title: payload.title?.trim() || "",
    sourceUrl: (payload.sourceUrl ?? fallbackSourceUrl).trim(),
    imageUrl: payload.imageUrl?.trim() || null,
    ingredients:
      ings.length > 0
        ? ings.map((i) => ({
            key: crypto.randomUUID(),
            name: i.name ?? "",
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
            notes: null,
            section: i.section ?? null,
          }))
        : [
            {
              key: crypto.randomUUID(),
              name: "",
              quantity: null,
              unit: null,
              notes: null,
              section: null,
            },
          ],
    instructionsText: formatInstructionSteps(payload.instructions ?? []),
  };
}

/** Read Swedish error body from FunctionsHttpError Response context. */
export async function edgeFunctionErrorMessage(
  error: { message?: string; context?: unknown },
  fallback = "Kunde inte hämta recept"
): Promise<string> {
  const ctx = error.context;
  if (ctx && typeof ctx === "object" && "json" in ctx && typeof (ctx as Response).json === "function") {
    try {
      const body = (await (ctx as Response).json()) as { error?: string };
      if (typeof body?.error === "string" && body.error.trim()) {
        return body.error.trim();
      }
    } catch {
      /* ignore */
    }
  }
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
