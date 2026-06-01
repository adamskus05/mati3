import { describe, expect, it } from "vitest";
import { computeLockedAppHeightPx } from "@/lib/pwa/safe-area-bottom";

describe("computeLockedAppHeightPx", () => {
  it("locks initial height to max of layout and visual viewport", () => {
    expect(computeLockedAppHeightPx(null, 750, 812)).toBe(812);
    expect(computeLockedAppHeightPx(null, 800, 780)).toBe(800);
  });

  it("does not shrink when visual viewport shrinks (keyboard)", () => {
    expect(computeLockedAppHeightPx(800, 800, 420)).toBe(800);
  });

  it("grows when layout viewport grows (rotation)", () => {
    expect(computeLockedAppHeightPx(800, 900, 420)).toBe(900);
  });
});
