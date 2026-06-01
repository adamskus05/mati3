import { describe, expect, it } from "vitest";
import {
  applyIngredientScale,
  computeScaleFactor,
  formatRecipeQuantity,
  scaleIngredientQuantity,
} from "@/lib/recipes/scale-ingredients";

const base = [
  {
    id: "a",
    recipe_id: "r",
    name: "Blandfärs",
    quantity: 500,
    unit: "g",
    notes: null,
    section: null,
    sort_order: 0,
    created_at: "",
  },
  {
    id: "b",
    recipe_id: "r",
    name: "Lök",
    quantity: 1,
    unit: "st",
    notes: null,
    section: null,
    sort_order: 1,
    created_at: "",
  },
  {
    id: "c",
    recipe_id: "r",
    name: "Salt",
    quantity: null,
    unit: null,
    notes: "nypa",
    section: null,
    sort_order: 2,
    created_at: "",
  },
];

describe("computeScaleFactor", () => {
  it("computes ratio for valid inputs", () => {
    expect(computeScaleFactor(500, 700)).toBeCloseTo(1.4);
  });

  it("returns null for invalid original", () => {
    expect(computeScaleFactor(0, 700)).toBeNull();
  });
});

describe("applyIngredientScale", () => {
  it("scales all quantities with numeric amount", () => {
    const { factor, rows } = applyIngredientScale(base, "a", 700);
    expect(factor).toBeCloseTo(1.4);
    expect(rows.find((r) => r.id === "a")?.scaledQuantity).toBe(700);
    expect(rows.find((r) => r.id === "b")?.scaledQuantity).toBe(1.4);
    expect(rows.find((r) => r.id === "c")?.scaledQuantity).toBeNull();
    expect(rows.find((r) => r.id === "c")?.isScaled).toBe(false);
  });

  it("returns unchanged when anchor missing", () => {
    const { factor, rows } = applyIngredientScale(base, null, 700);
    expect(factor).toBeNull();
    expect(rows.every((r) => !r.isScaled)).toBe(true);
  });
});

describe("formatRecipeQuantity", () => {
  it("formats with unit", () => {
    expect(formatRecipeQuantity(700, "g")).toContain("700");
    expect(formatRecipeQuantity(700, "g")).toContain("g");
  });
});

describe("scaleIngredientQuantity", () => {
  it("rounds to two decimals", () => {
    expect(scaleIngredientQuantity(1, 1.4)).toBe(1.4);
  });
});
