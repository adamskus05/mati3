const INSTRUCTION_SECTION_PREFIX = "## ";

export type ParsedIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
  raw?: string;
  section?: string;
};

export type ParsedRecipe = {
  title: string;
  imageUrl?: string;
  ingredients: ParsedIngredient[];
  instructions: string[];
};

const UNITS =
  /^(st|kg|g|l|dl|cl|ml|msk|tsk|krm|paket|förp|burk|näve|bit|bitar|förpackning)\b/i;

/** Leading quantity including unicode fractions (½, 1½, 3½). */
const QUANTITY_PREFIX =
  /^((?:\d+(?:[.,]\d+)?|\d+\/\d+)|[½¼¾⅓⅔]|\d+[½¼¾])(?:\s+|$)/;

/** e.g. "64 g (3 msk) Honung" — prefer the kitchen measure in parentheses. */
const GRAMS_WITH_PAREN_MEASURE =
  /^(\d+(?:[.,]\d+)?)\s+([a-zåäö]+)\s+\((\d+(?:[.,]\d+)?)\s+([a-zåäö]+)\)\s+(.+)$/i;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  aring: "å",
  Aring: "Å",
  auml: "ä",
  Auml: "Ä",
  ouml: "ö",
  Ouml: "Ö",
  eacute: "é",
  Eacute: "É",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  agrave: "à",
  egrave: "è",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  times: "×",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
};

/** Decode HTML entities commonly found in broken JSON-LD (Drygast, etc.). */
export function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes("&")) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name: string) => {
      return NAMED_HTML_ENTITIES[name] ?? match;
    });
}

function parseQuantityToken(q: string): number | undefined {
  if (q.includes("/")) {
    const [a, b] = q.split("/").map(Number);
    return b ? a / b : Number(a);
  }
  if (/[½¼¾]/.test(q)) {
    const unicodeMap: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };
    const digitMixed = q.match(/^(\d+)([½¼¾])$/);
    if (digitMixed) {
      return parseInt(digitMixed[1], 10) + (unicodeMap[digitMixed[2]] ?? 0);
    }
    return unicodeMap[q];
  }
  const n = parseFloat(q.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

const INSTRUCTION_TYPES = new Set([
  "HowToStep",
  "HowToDirection",
  "HowToSection",
  "HowToTip",
]);

/** Parse a free-text ingredient line (Swedish-friendly). */
export function parseIngredientLine(line: string): ParsedIngredient {
  const raw = decodeHtmlEntities(line.trim());
  if (!raw) return { name: "", raw };

  const paren = raw.match(GRAMS_WITH_PAREN_MEASURE);
  if (paren) {
    const parenUnit = paren[4]!.toLowerCase();
    const outerUnit = paren[2]!.toLowerCase();
    // Prefer volumetric/count measures in parentheses when present (msk, tsk, st, …)
    if (UNITS.test(parenUnit)) {
      const quantity = parseQuantityToken(paren[3]!);
      const name = paren[5]!.trim();
      if (name) {
        return {
          name,
          quantity,
          unit: parenUnit,
          raw,
        };
      }
    }
    if (UNITS.test(outerUnit)) {
      return {
        name: paren[5]!.trim() || raw,
        quantity: parseQuantityToken(paren[1]!),
        unit: outerUnit,
        raw,
      };
    }
  }

  const parts = raw.split(/\s+/);
  let quantity: number | undefined;
  let unit: string | undefined;
  let nameStart = 0;

  const qtyPrefix = raw.match(QUANTITY_PREFIX);
  if (qtyPrefix) {
    quantity = parseQuantityToken(qtyPrefix[1]!);
    const consumed = qtyPrefix[0].trim().split(/\s+/).length;
    nameStart = consumed;
    if (parts[nameStart] && UNITS.test(parts[nameStart])) {
      unit = parts[nameStart].toLowerCase();
      nameStart += 1;
    }
  } else if (parts[0] && UNITS.test(parts[0]) && parts[1]) {
    unit = parts[0].toLowerCase();
    nameStart = 1;
  }

  const name = parts.slice(nameStart).join(" ").trim() || raw;
  return { name, quantity, unit, raw };
}

function normalizeSectionLabel(label: string): string {
  return label.replace(/:$/, "").trim().toLowerCase();
}

function looksLikeIngredientAmount(line: string): boolean {
  const raw = line.trim();
  if (!raw) return false;
  if (QUANTITY_PREFIX.test(raw)) return true;
  const parsed = parseIngredientLine(raw);
  return parsed.quantity != null || Boolean(parsed.unit);
}

/** Heuristic: line is a group heading (e.g. "Till biffarna:") not an ingredient. */
export function isIngredientHeaderLine(line: string): boolean {
  const raw = line.trim();
  if (!raw) return false;
  if (raw.endsWith(":")) return true;
  if (looksLikeIngredientAmount(raw)) return false;
  if (/^till\s+/i.test(raw)) return true;
  return false;
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

function normalizedTypeName(obj: Record<string, unknown>): string {
  const types = nodeTypes(obj);
  const t = types[0];
  return t ? t.replace(/^.*\//, "") : "";
}

function isRecipeNode(obj: Record<string, unknown>): boolean {
  return nodeTypes(obj).some(
    (t) => t === "Recipe" || t.endsWith("/Recipe") || t.endsWith("Recipe")
  );
}

function isInstructionContainer(obj: Record<string, unknown>): boolean {
  return nodeTypes(obj).some((t) => INSTRUCTION_TYPES.has(t.replace(/^.*\//, "")));
}

function isListItem(obj: Record<string, unknown>): boolean {
  return normalizedTypeName(obj) === "ListItem";
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

function buildJsonLdIdMap(
  data: unknown,
  map = new Map<string, Record<string, unknown>>()
): Map<string, Record<string, unknown>> {
  if (!data || typeof data !== "object") return map;

  if (Array.isArray(data)) {
    for (const item of data) buildJsonLdIdMap(item, map);
    return map;
  }

  const obj = data as Record<string, unknown>;
  const id = obj["@id"];
  if (typeof id === "string") map.set(id, obj);

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") buildJsonLdIdMap(value, map);
  }

  return map;
}

function resolveJsonLdNode(
  value: unknown,
  idMap: Map<string, Record<string, unknown>>
): unknown {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => resolveJsonLdNode(item, idMap));
  }

  const obj = value as Record<string, unknown>;
  const id = obj["@id"];
  if (
    typeof id === "string" &&
    idMap.has(id) &&
    Object.keys(obj).length <= 2 &&
    !obj.name &&
    !obj.text &&
    !obj.recipeIngredient
  ) {
    return idMap.get(id);
  }

  return obj;
}

/**
 * Escape raw control characters inside JSON string literals so sites with
 * broken JSON-LD (e.g. foodbydrygast.com) still parse.
 */
export function sanitizeJsonLdText(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        result += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }
    result += ch;
  }
  return result;
}

/** Split HTML instruction blobs into plain step lines. */
export function flattenHtmlInstructionText(html: string): string[] {
  const withBreaks = decodeHtmlEntities(html)
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<\s*\/?\s*(ol|ul)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return withBreaks
    .split(/\n+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .map((s) => s.replace(/^\d+[\.\):\-]\s*/, "").trim())
    .filter(Boolean);
}

function expandInstructionStep(step: string): string[] {
  const decoded = decodeHtmlEntities(step);
  if (/<[a-z][\s\S]*>/i.test(decoded)) {
    return flattenHtmlInstructionText(decoded);
  }
  return [decoded];
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const text = match[1].trim();
    try {
      blocks.push(JSON.parse(sanitizeJsonLdText(text)));
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

function ingredientObjectToLine(o: Record<string, unknown>): string | null {
  if (typeof o.name === "string" && o.name.trim()) {
    const amount = o.amount ?? o.quantity;
    const unit = o.unit ?? o.unitText;
    if (amount != null && unit) return `${amount} ${unit} ${o.name}`;
    if (amount != null) return `${amount} ${o.name}`;
    return o.name;
  }
  return null;
}

function parseIngredientsFromItems(
  items: unknown[],
  idMap: Map<string, Record<string, unknown>>,
  section?: string
): ParsedIngredient[] {
  const out: ParsedIngredient[] = [];
  let currentSection = section;

  function addLine(line: string, activeSection?: string) {
    const trimmed = line.replace(/\s+/g, " ").trim();
    if (!trimmed) return;
    if (isIngredientHeaderLine(trimmed)) {
      currentSection = trimmed.replace(/:$/, "").trim();
      return;
    }
    const sectionForLine = activeSection ?? currentSection;
    if (
      sectionForLine &&
      normalizeSectionLabel(trimmed) === normalizeSectionLabel(sectionForLine)
    ) {
      return;
    }
    const ing = parseIngredientLine(trimmed);
    if (!ing.name) return;
    if (
      sectionForLine &&
      normalizeSectionLabel(ing.name) === normalizeSectionLabel(sectionForLine)
    ) {
      return;
    }
    out.push({ ...ing, section: sectionForLine });
  }

  function processItem(item: unknown, inheritedSection?: string) {
    if (typeof item === "string") {
      addLine(item, inheritedSection);
      return;
    }
    if (!item || typeof item !== "object") return;

    const resolved = resolveJsonLdNode(item, idMap) as Record<string, unknown>;
    const nested =
      resolved.recipeIngredient ??
      resolved.itemListElement ??
      resolved.ingredients;
    const groupName =
      (typeof resolved.name === "string" && resolved.name.trim()) || inheritedSection;

    if (nested) {
      const sec =
        nested === resolved.recipeIngredient ||
        nested === resolved.itemListElement ||
        nested === resolved.ingredients
          ? groupName || currentSection
          : inheritedSection;
      if (Array.isArray(nested)) {
        for (const child of nested) processItem(child, sec);
      } else {
        processItem(nested, sec);
      }
      return;
    }

    const line = ingredientObjectToLine(resolved);
    if (line) addLine(line, inheritedSection);
  }

  for (const item of items) processItem(item, section);
  return out;
}

function parseIngredientsField(
  field: unknown,
  idMap: Map<string, Record<string, unknown>>
): ParsedIngredient[] {
  if (!field) return [];

  const resolved = resolveJsonLdNode(field, idMap);

  if (typeof resolved === "string") {
    return parseIngredientsFromItems(resolved.split(/\n+/), idMap);
  }

  if (Array.isArray(resolved)) {
    return parseIngredientsFromItems(resolved, idMap);
  }

  if (resolved && typeof resolved === "object") {
    return parseIngredientsFromItems([resolved], idMap);
  }

  return [];
}

function getNestedInstructions(o: Record<string, unknown>): unknown | undefined {
  return o.itemListElement ?? o.step ?? o.steps ?? o.instruction ?? o.instructions;
}

function hasNestedContent(nested: unknown): boolean {
  if (nested == null) return false;
  if (Array.isArray(nested)) return nested.length > 0;
  return true;
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
  if (isListItem(o)) {
    const item = o.item;
    if (item && typeof item === "object") {
      collectInstructionStepsFromObject(item as Record<string, unknown>, out);
    } else if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
    }
    return;
  }

  const nested = getNestedInstructions(o);
  const hasNested = hasNestedContent(nested);
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";

  if (isInstructionContainer(o) && name && hasNested && !text) {
    out.push(`${INSTRUCTION_SECTION_PREFIX}${name}`);
  } else if (text) {
    out.push(text);
  } else if (name && !hasNested) {
    out.push(name);
  }

  if (hasNested) collectInstructionSteps(nested, out);
}

function parseInstructionsField(field: unknown): string[] {
  const steps: string[] = [];
  collectInstructionSteps(field, steps);
  return steps
    .flatMap(expandInstructionStep)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function decodeArlaEmbeddedText(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

type ArlaIngredientGroupJson = {
  title?: string | null;
  ingredients?: {
    formattedName?: string;
    formattedAmount?: string;
  }[];
};

/** Arla embeds grouped ingredients in page HTML (more accurate than flat JSON-LD). */
function parseArlaIngredientGroupsFromHtml(html: string): ParsedIngredient[] | null {
  const key = "ingredientGroups";
  const idx = html.indexOf(key);
  if (idx < 0) return null;

  const start = html.indexOf("[", idx);
  if (start < 0) return null;

  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  let groups: ArlaIngredientGroupJson[];
  try {
    groups = JSON.parse(decodeArlaEmbeddedText(html.slice(start, end))) as ArlaIngredientGroupJson[];
  } catch {
    return null;
  }

  if (!Array.isArray(groups) || groups.length === 0) return null;

  const out: ParsedIngredient[] = [];
  for (const group of groups) {
    const section = group.title?.trim().replace(/:$/, "") || undefined;
    for (const item of group.ingredients ?? []) {
      const name = decodeArlaEmbeddedText(item.formattedName ?? "").trim();
      const amount = decodeArlaEmbeddedText(item.formattedAmount ?? "").trim();
      if (!name) continue;
      const line = amount ? `${amount} ${name}` : name;
      if (section && normalizeSectionLabel(line) === normalizeSectionLabel(section)) {
        continue;
      }
      const ing = parseIngredientLine(line);
      if (!ing.name) continue;
      if (section && normalizeSectionLabel(ing.name) === normalizeSectionLabel(section)) {
        continue;
      }
      out.push({ ...ing, section });
    }
  }

  return out.length > 0 ? out : null;
}

/** Extract recipe from HTML using schema.org JSON-LD (and common variants). */
export function parseRecipeFromHtml(html: string, _sourceUrl: string): ParsedRecipe | null {
  const blocks = extractJsonLdBlocks(html);
  const arlaIngredients = parseArlaIngredientGroupsFromHtml(html);

  for (const block of blocks) {
    const idMap = buildJsonLdIdMap(block);
    const recipe = findRecipeNode(block);
    if (!recipe) continue;

    const title =
      (typeof recipe.name === "string" && recipe.name.trim()) ||
      (typeof recipe.headline === "string" && recipe.headline.trim()) ||
      "Recept utan titel";

    const rawIngredients = recipe.recipeIngredient ?? recipe.ingredients;
    const ingredients =
      arlaIngredients ?? parseIngredientsField(rawIngredients, idMap);
    const instructions = parseInstructionsField(
      recipe.recipeInstructions ?? recipe.instructions
    );

    if (ingredients.length === 0 && instructions.length === 0) continue;

    return {
      title: decodeHtmlEntities(title.trim()),
      imageUrl: normalizeImage(recipe.image),
      ingredients,
      instructions,
    };
  }
  return null;
}
