import { describe, it, expect } from "vitest";
import {
  generateFractionalIndex,
  rebalanceIndices,
} from "../lib/fractional-indexing";

describe("Fractional Indexing Algorithm (Client-Side)", () => {
  it("should return default 'a0' when no bounds are provided", () => {
    expect(generateFractionalIndex(null, null)).toBe("a0");
  });

  it("should generate a key smaller than target when prepending before item", () => {
    const first = "a0";
    const prepended = generateFractionalIndex(null, first);
    expect(prepended < first).toBe(true);

    const prependedTwice = generateFractionalIndex(null, prepended);
    expect(prependedTwice < prepended).toBe(true);
  });

  it("should generate a key larger than target when appending after item", () => {
    const base = "a0";
    const appended = generateFractionalIndex(base, null);
    expect(appended > base).toBe(true);

    const appendedTwice = generateFractionalIndex(appended, null);
    expect(appendedTwice > appended).toBe(true);
  });

  it("should insert strictly between two items", () => {
    const a = "a0";
    const b = "a9";
    const mid = generateFractionalIndex(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);
  });

  it("should insert strictly between adjacent characters by extending precision", () => {
    const a = "a0";
    const b = "a1";
    const mid = generateFractionalIndex(a, b);
    expect(a < mid).toBe(true);
    expect(mid < b).toBe(true);

    const mid2 = generateFractionalIndex(a, mid);
    expect(a < mid2).toBe(true);
    expect(mid2 < mid).toBe(true);
  });

  it("should maintain sequential sorting order across 50 rapid insertions", () => {
    const items = ["a0", "z9"];
    for (let i = 0; i < 50; i++) {
      const midIdx = Math.floor(items.length / 2);
      const newKey = generateFractionalIndex(items[midIdx - 1], items[midIdx]);
      items.splice(midIdx, 0, newKey);
    }

    const sorted = [...items].sort();
    expect(items).toEqual(sorted);
    expect(new Set(items).size).toBe(items.length);
  });

  it("should throw error if before >= after", () => {
    expect(() => generateFractionalIndex("b0", "a0")).toThrow();
    expect(() => generateFractionalIndex("a0", "a0")).toThrow();
  });

  it("should produce evenly spaced and ordered keys on rebalance", () => {
    const keys = rebalanceIndices(12);
    expect(keys.length).toBe(12);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(new Set(keys).size).toBe(12);
  });
});
