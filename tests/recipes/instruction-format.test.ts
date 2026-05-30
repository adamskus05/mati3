import { describe, expect, it } from "vitest";
import {
  formatInstructionSteps,
  groupIngredientsBySection,
  groupInstructionSteps,
  parseInstructionLines,
  stripStepPrefix,
  INSTRUCTION_SECTION_PREFIX,
} from "@/lib/recipes/instruction-format";

describe("instruction-format", () => {
  it("formats steps with numbers", () => {
    expect(formatInstructionSteps(["Blanda", "Stek"])).toBe(
      "1. Blanda\n2. Stek"
    );
  });

  it("preserves section headers and resets numbering", () => {
    const steps = [
      `${INSTRUCTION_SECTION_PREFIX}Förbered`,
      "Skär löken",
      `${INSTRUCTION_SECTION_PREFIX}Blanda`,
      "Blanda allt",
    ];
    expect(formatInstructionSteps(steps)).toBe(
      "## Förbered\n1. Skär löken\n## Blanda\n1. Blanda allt"
    );
  });

  it("strips existing numbers when parsing", () => {
    const text = "1. Blanda\n2. Stek\n3. Servera";
    expect(parseInstructionLines(text)).toEqual(["Blanda", "Stek", "Servera"]);
  });

  it("keeps ## lines when parsing", () => {
    const text = "## Förbered\n1. Hacka\n## Blanda\n1. Rör";
    expect(parseInstructionLines(text)).toEqual([
      "## Förbered",
      "Hacka",
      "## Blanda",
      "Rör",
    ]);
  });

  it("stripStepPrefix handles variants", () => {
    expect(stripStepPrefix("3) Gör klart")).toBe("Gör klart");
  });

  it("groups instruction steps by section", () => {
    expect(
      groupInstructionSteps([
        "## Förbered",
        "A",
        "## Blanda",
        "B",
      ])
    ).toEqual([
      { section: "Förbered", steps: ["A"] },
      { section: "Blanda", steps: ["B"] },
    ]);
  });

  it("groups ingredients by section", () => {
    expect(
      groupIngredientsBySection([
        { name: "a", section: "Biff" },
        { name: "b", section: "Biff" },
        { name: "c", section: "Sås" },
      ])
    ).toEqual([
      { section: "Biff", items: [{ name: "a", section: "Biff" }, { name: "b", section: "Biff" }] },
      { section: "Sås", items: [{ name: "c", section: "Sås" }] },
    ]);
  });
});
