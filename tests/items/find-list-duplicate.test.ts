import { describe, expect, it } from "vitest";
import { findListDuplicate } from "@/lib/items/find-list-duplicate";

describe("findListDuplicate", () => {
  const items = [
    { id: "1", name: "Mjölk", unit: "l", completed: false },
    { id: "2", name: "Bröd", unit: null, completed: true },
    { id: "3", name: "Gula lökar", unit: null, completed: false },
  ];

  it("matches normalized names among open items", () => {
    expect(findListDuplicate(items, "gul lök", null)?.id).toBe("3");
  });

  it("ignores completed items", () => {
    expect(findListDuplicate(items, "bröd", null)).toBeNull();
  });

  it("returns null when no match", () => {
    expect(findListDuplicate(items, "Smör", null)).toBeNull();
  });
});
