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

const INSTRUCTION_TYPES = new Set([
  "HowToStep",
  "HowToDirection",
  "HowToSection",
  "HowToTip",
]);

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

function schemaTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === "string");
  return [];
}

function nodeTypes(obj: Record<string, unknown>): string[] {
  const fromAt = schemaTypes(obj["@type"]);
  const fromType = schemaTypes(obj["type"]);
  return [...fromAt, ...fromType];
}

function isRecipeNode(obj: Record<string, unknown>): boolean {
  return nodeTypes(obj).some(
    (t) => t === "Recipe" || t.endsWith("/Recipe") || t.endsWith("Recipe")
  );
}

function isInstructionContainer(obj: Record<string, unknown>): boolean {
  return nodeTypes(obj).some((t) => INSTRUCTION_TYPES.has(t.replace(/^.*\//, "")));
}

function findRecipeNode(data: unknown): Record<string, unknown> | null {
  if (!data) return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  if (isRecipeNode(obj)) return obj;

  const graph = obj["@graph"];
  if (Array.isArray(graph)) {
    for (const node of graph) {
      const found = findRecipeNode(node);
      if (found) return found;
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findRecipeNode(value);
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
  if (Array.isArray(image)) {
    for (const item of image) {
      const url = normalizeImage(item);
      if (url) return url;
    }
    return undefined;
  }
  if (image && typeof image === "object") {
    const o = image as Record<string, unknown>;
    if (typeof o.url === "string") return o.url;
    if (typeof o.contentUrl === "string") return o.contentUrl;
  }
  return undefined;
}

function parseIngredientsField(field: unknown): ParsedIngredient[] {
  if (!field) return [];
  const lines: string[] = [];
  if (typeof field === "string") {
    lines.push(...field.split(/\n+/));
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

function collectInstructionSteps(field: unknown, out: string[]): void {
  if (!field) return;

  if (typeof field === "string") {
    const trimmed = field.trim();
    if (trimmed) {
      if (trimmed.includes("\n")) {
        for (const line of trimmed.split(/\n+/)) {
          const t = line.trim();
          if (t) out.push(t);
        }
      } else {
        out.push(trimmed);
      }
    }
    return;
  }

  if (!Array.isArray(field)) {
    if (typeof field === "object" && field !== null) {
      collectInstructionStepsFromObject(field as Record<string, unknown>, out);
    }
    return;
  }

  for (const item of field) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push(t);
    } else if (item && typeof item === "object") {
      collectInstructionStepsFromObject(item as Record<string, unknown>, out);
    }
  }
}

function collectInstructionStepsFromObject(
  o: Record<string, unknown>,
  out: string[]
): void {
  if (typeof o.text === "string" && o.text.trim()) {
    out.push(o.text.trim());
    return;
  }
  if (typeof o.name === "string" && o.name.trim() && isInstructionContainer(o)) {
    // Section title only — skip unless no text
    return;
  }
  if (typeof o.name === "string" && o.name.trim() && !isInstructionContainer(o)) {
    out.push(o.name.trim());
    return;
  }

  const nested =
    o.itemListElement ?? o.step ?? o.steps ?? o.instruction ?? o.instructions;
  if (nested) collectInstructionSteps(nested, out);
}

function parseInstructionsField(field: unknown): string[] {
  const steps: string[] = [];
  collectInstructionSteps(field, steps);
  return steps
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Extract recipe from HTML using schema.org JSON-LD (and common variants). */
export function parseRecipeFromHtml(html: string, _sourceUrl: string): ParsedRecipe | null {
  const blocks = extractJsonLdBlocks(html);

  for (const block of blocks) {
    const recipe = findRecipeNode(block);
    if (!recipe) continue;

    const title =
      (typeof recipe.name === "string" && recipe.name.trim()) ||
      (typeof recipe.headline === "string" && recipe.headline.trim()) ||
      "Recept utan titel";

    const ingredients = parseIngredientsField(
      recipe.recipeIngredient ?? recipe.ingredients
    );
    const instructions = parseInstructionsField(
      recipe.recipeInstructions ?? recipe.instructions
    );

    if (ingredients.length === 0 && instructions.length === 0) continue;

    return {
      title: title.trim(),
      imageUrl: normalizeImage(recipe.image),
      ingredients,
      instructions,
    };
  }
  return null;
}
