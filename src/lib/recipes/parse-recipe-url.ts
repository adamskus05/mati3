export type ParsedIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
  raw?: string;
};

export type ParsedRecipe = {
  title: string;
  imageUrl?: string;
  ingredients: ParsedIngredient[];
  instructions: string[];
};

const UNITS =
  /^(st|kg|g|l|dl|cl|ml|msk|tsk|krm|paket|förp|burk|näve|bit|bitar|förpackning)\b/i;

/** Parse a free-text ingredient line (Swedish-friendly). */
export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = line.trim();
  if (!raw) return { name: "", raw };

  const parts = raw.split(/\s+/);
  let quantity: number | undefined;
  let unit: string | undefined;
  let nameStart = 0;

  const first = parts[0]?.replace(",", ".");
  const qtyMatch = first?.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)$/);
  if (qtyMatch) {
    const q = qtyMatch[1];
    if (q.includes("/")) {
      const [a, b] = q.split("/").map(Number);
      quantity = b ? a / b : Number(a);
    } else {
      quantity = parseFloat(q.replace(",", "."));
    }
    nameStart = 1;
    if (parts[1] && UNITS.test(parts[1])) {
      unit = parts[1].toLowerCase();
      nameStart = 2;
    }
  } else if (parts[0] && UNITS.test(parts[0]) && parts[1]) {
    unit = parts[0].toLowerCase();
    nameStart = 1;
  }

  const name = parts.slice(nameStart).join(" ").trim() || raw;
  return { name, quantity, unit, raw };
}

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") {
    return type === "Recipe" || type.endsWith("/Recipe");
  }
  if (Array.isArray(type)) {
    return type.some((t) => isRecipeType(t));
  }
  return false;
}

function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (isRecipeType(obj["@type"])) return obj;
  const graph = obj["@graph"];
  if (Array.isArray(graph)) {
    for (const node of graph) {
      const found = findRecipeNode(node);
      if (found) return found;
    }
  }
  return null;
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = match[1].trim();
    try {
      blocks.push(JSON.parse(text));
    } catch {
      // ignore invalid JSON
    }
  }
  return blocks;
}

function normalizeImage(image: unknown): string | undefined {
  if (typeof image === "string") return image;
  if (Array.isArray(image) && typeof image[0] === "string") return image[0];
  if (image && typeof image === "object" && "url" in image) {
    const url = (image as { url?: string }).url;
    if (typeof url === "string") return url;
  }
  return undefined;
}

function parseIngredientsField(field: unknown): ParsedIngredient[] {
  if (!field) return [];
  const lines: string[] = [];
  if (typeof field === "string") {
    lines.push(field);
  } else if (Array.isArray(field)) {
    for (const item of field) {
      if (typeof item === "string") lines.push(item);
      else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.name === "string") {
          const amount = o.amount ?? o.quantity;
          const unit = o.unit ?? o.unitText;
          if (amount != null && unit) {
            lines.push(`${amount} ${unit} ${o.name}`);
          } else if (amount != null) {
            lines.push(`${amount} ${o.name}`);
          } else {
            lines.push(o.name);
          }
        }
      }
    }
  }
  return lines
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map(parseIngredientLine)
    .filter((i) => i.name);
}

function parseInstructionsField(field: unknown): string[] {
  if (!field) return [];
  if (typeof field === "string") {
    return field
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(field)) return [];

  const steps: string[] = [];
  for (const item of field) {
    if (typeof item === "string") {
      steps.push(item.trim());
    } else if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.text === "string") steps.push(o.text.trim());
      else if (typeof o.name === "string") steps.push(o.name.trim());
      else if (Array.isArray(o.itemListElement)) {
        for (const sub of o.itemListElement) {
          if (typeof sub === "string") steps.push(sub.trim());
          else if (sub && typeof sub === "object" && typeof (sub as { text?: string }).text === "string") {
            steps.push((sub as { text: string }).text.trim());
          }
        }
      }
    }
  }
  return steps.filter(Boolean);
}

/** Extract recipe from HTML using schema.org JSON-LD. */
export function parseRecipeFromHtml(html: string, sourceUrl: string): ParsedRecipe | null {
  const blocks = extractJsonLdBlocks(html);
  for (const block of blocks) {
    const recipe = findRecipeNode(block);
    if (!recipe) continue;

    const title =
      (typeof recipe.name === "string" && recipe.name) ||
      (typeof recipe.headline === "string" && recipe.headline) ||
      "Recept utan titel";

    const ingredients = parseIngredientsField(
      recipe.recipeIngredient ?? recipe.ingredients
    );
    const instructions = parseInstructionsField(
      recipe.recipeInstructions ?? recipe.instructions
    );

    if (ingredients.length === 0 && instructions.length === 0) continue;

    return {
      title,
      imageUrl: normalizeImage(recipe.image),
      ingredients,
      instructions,
      ...(sourceUrl ? {} : {}),
    };
  }
  return null;
}
