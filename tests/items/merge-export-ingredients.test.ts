import { describe, expect, it } from "vitest";
import {
  canMergeUnits,
  mergeQuantities,
  normalizeIngredientKey,
  planExportMerge,
} from "@/lib/items/merge-export-ingredients";

describe("normalizeIngredientKey", () => {
  it("matches gul lök and gula lökar", () => {
    expect(normalizeIngredientKey("1 gul lök")).toBe(
      normalizeIngredientKey("2 gula lökar")
    );
  });
});

describe("planExportMerge", () => {
  it("merges export into existing row with summed quantity", () => {
    const existing = [
      {
        id: "item-1",
        name: "2 gula lökar",
        quantity: 2,
        unit: "st",
        notes: null,
        category_id: null,
        completed: false,
        sort_order: 0,
      },
    ];

    const plan = planExportMerge(
      existing,
      [{ name: "1 gul lök", quantity: 1, unit: "st", notes: null }],
      () => 1
    );

    expect(plan.merged).toBe(1);
    expect(plan.added).toBe(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].quantity).toBe(3);
    expect(plan.inserts).toHaveLength(0);
  });

  it("inserts when units differ", () => {
    const existing = [
      {
        id: "item-1",
        name: "Mjöl",
        quantity: 500,
        unit: "g",
        notes: null,
        category_id: null,
        completed: false,
        sort_order: 0,
      },
    ];

    const plan = planExportMerge(
      existing,
      [{ name: "Mjöl", quantity: 2, unit: "dl", notes: null }],
      () => 1
    );

    expect(plan.merged).toBe(0);
    expect(plan.added).toBe(1);
  });
});

describe("mergeQuantities", () => {
  it("sums two numbers", () => {
    expect(mergeQuantities(2, 1)).toBe(3);
  });
});

describe("canMergeUnits", () => {
  it("allows both empty", () => {
    expect(canMergeUnits(null, null)).toBe(true);
  });
});
