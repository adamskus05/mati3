export const INSTRUCTION_SECTION_PREFIX = "## ";

/** Phase heading line stored in instructions JSON (not a numbered step). */
export function isInstructionSectionLine(line: string): boolean {
  return line.trimStart().startsWith(INSTRUCTION_SECTION_PREFIX);
}

/** Remove leading "1. " / "2) " style prefixes from a step line. */
export function stripStepPrefix(line: string): string {
  return line.replace(/^\d+[\.\):\-]\s*/, "").trim();
}

/** Editor/display: numbered steps; ## lines stay unnumbered; counter resets after each section. */
export function formatInstructionSteps(steps: string[]): string {
  let stepNum = 0;
  const lines: string[] = [];

  for (const raw of steps) {
    const s = raw.trim();
    if (!s) continue;
    if (isInstructionSectionLine(s)) {
      stepNum = 0;
      lines.push(s.startsWith(INSTRUCTION_SECTION_PREFIX) ? s : `${INSTRUCTION_SECTION_PREFIX}${s}`);
      continue;
    }
    const body = stripStepPrefix(s);
    if (!body) continue;
    stepNum += 1;
    lines.push(`${stepNum}. ${body}`);
  }

  return lines.join("\n");
}

/** Parse textarea / stored lines into clean step strings (no numbers; keeps ## headers). */
export function parseInstructionLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (isInstructionSectionLine(trimmed)) return trimmed;
      return stripStepPrefix(trimmed);
    })
    .filter(Boolean);
}

export type InstructionStepGroup = {
  section: string | null;
  steps: string[];
};

/** Split stored steps into section groups for rendering. */
export function groupInstructionSteps(steps: string[]): InstructionStepGroup[] {
  const groups: InstructionStepGroup[] = [];
  let current: InstructionStepGroup = { section: null, steps: [] };

  for (const step of steps) {
    if (isInstructionSectionLine(step)) {
      if (current.section || current.steps.length > 0) groups.push(current);
      current = {
        section: step.slice(INSTRUCTION_SECTION_PREFIX.length).trim() || null,
        steps: [],
      };
    } else {
      current.steps.push(step);
    }
  }

  if (current.section || current.steps.length > 0) groups.push(current);
  return groups;
}

export type IngredientGroup<T> = {
  section: string | null;
  items: T[];
};

/** Group ingredient rows by section (preserves order). */
export function groupIngredientsBySection<T extends { section?: string | null }>(
  items: T[]
): IngredientGroup<T>[] {
  const groups: IngredientGroup<T>[] = [];

  for (const item of items) {
    const sec = item.section?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.section === sec) {
      last.items.push(item);
    } else {
      groups.push({ section: sec, items: [item] });
    }
  }

  return groups;
}
