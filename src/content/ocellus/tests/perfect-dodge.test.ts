import { describe, expect, it } from "vitest";
import { dodgeCutTicks, rewardedCooldown } from "../js/OcellusTimings";

describe("perfect dodge", () => {
  it("halves a 4-tick weapon and cuts three off it under the other rule", () => {
    expect(rewardedCooldown("halved", 4)).toBe(2);
    expect(rewardedCooldown("minus-3", 4)).toBe(1);
    expect(dodgeCutTicks("halved", 4)).toBe(2);
    expect(dodgeCutTicks("minus-3", 4)).toBe(3);
  });

  it("cuts 5-tick and 6-tick weapons by 3 either way", () => {
    expect(dodgeCutTicks("halved", 5)).toBe(3);
    expect(dodgeCutTicks("minus-3", 5)).toBe(3);
    expect(dodgeCutTicks("halved", 6)).toBe(3);
    expect(dodgeCutTicks("minus-3", 6)).toBe(3);
  });
});
