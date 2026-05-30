/** Remove leading "1. " / "2) " style prefixes from a step line. */
export function stripStepPrefix(line: string): string {
  return line.replace(/^\d+[\.\):\-]\s*/, "").trim();
}

/** Editor/display: one numbered step per line. */
export function formatInstructionSteps(steps: string[]): string {
  return steps
    .map((s) => stripStepPrefix(s.trim()))
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
}

/** Parse textarea / stored lines into clean step strings (no numbers). */
export function parseInstructionLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => stripStepPrefix(line.trim()))
    .filter(Boolean);
}
