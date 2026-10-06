import { describe, expect, it } from "vitest";
import { computeQuote, quoteLines } from "./pricing";

const npr = (n: number) => `NPR ${n}`;

describe("computeQuote", () => {
  it("charges the room rate per night", () => {
    const q = computeQuote({ nights: 3, pricePerNightNpr: 3000, childPricePerNightNpr: 500, children: 0 });
    expect(q.totalPriceNpr).toBe(9000);
    expect(q.childSubtotalNpr).toBe(0);
  });
  it("adds the child rate per child per night", () => {
    const q = computeQuote({ nights: 2, pricePerNightNpr: 4500, childPricePerNightNpr: 500, children: 2 });
    expect(q.roomSubtotalNpr).toBe(9000);
    expect(q.childSubtotalNpr).toBe(2000);
    expect(q.totalPriceNpr).toBe(11000);
  });
  it("treats a zero child rate as free", () => {
    const q = computeQuote({ nights: 2, pricePerNightNpr: 3000, childPricePerNightNpr: 0, children: 1 });
    expect(q.totalPriceNpr).toBe(6000);
  });
});

describe("quoteLines", () => {
  it("shows the child line only when children are charged", () => {
    const a = computeQuote({ nights: 1, pricePerNightNpr: 3000, childPricePerNightNpr: 500, children: 0 });
    expect(quoteLines(a, npr)).toEqual(["1 night × NPR 3000 = NPR 3000"]);
    const b = computeQuote({ nights: 2, pricePerNightNpr: 4500, childPricePerNightNpr: 500, children: 1 });
    expect(quoteLines(b, npr)).toEqual([
      "2 nights × NPR 4500 = NPR 9000",
      "2 nights × 1 child × NPR 500 = NPR 1000",
    ]);
  });
});
