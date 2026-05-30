import { describe, expect, it } from "vitest";
import {
  formatInstructionSteps,
  parseInstructionLines,
  stripStepPrefix,
} from "@/lib/recipes/instruction-format";

describe("instruction-format", () => {
  it("formats steps with numbers", () => {
    expect(formatInstructionSteps(["Blanda", "Stek"])).toBe(
      "1. Blanda\n2. Stek"
    );
  });

  it("strips existing numbers when parsing", () => {
    const text = "1. Blanda\n2. Stek\n3. Servera";
    expect(parseInstructionLines(text)).toEqual(["Blanda", "Stek", "Servera"]);
  });

  it("stripStepPrefix handles variants", () => {
    expect(stripStepPrefix("3) Gör klart")).toBe("Gör klart");
  });
});
