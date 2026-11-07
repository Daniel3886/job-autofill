import { describe, expect, it } from "vitest";
import { convertAmount, formatAmount, parseAmount } from "./salary";

describe("salary period conversion", () => {
  it("converts between hourly, monthly and yearly at 168 hours a month", () => {
    expect(convertAmount(100, "hour", "month")).toBe(16800);
    expect(convertAmount(16800, "month", "hour")).toBe(100);
    expect(convertAmount(15000, "month", "year")).toBe(180000);
    expect(convertAmount(100, "hour", "year")).toBe(201600);
    expect(convertAmount(15000, "month", "month")).toBe(15000);
  });

  it("rounds hourly amounts to grosze and the rest to whole złoty", () => {
    expect(formatAmount(convertAmount(15000, "month", "hour"), "hour")).toBe("89.29");
    expect(formatAmount(convertAmount(95.5, "hour", "month"), "month")).toBe("16044");
  });

  it("parses amounts with spaces and decimal commas", () => {
    expect(parseAmount("15 000")).toBe(15000);
    expect(parseAmount("95,5")).toBe(95.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});
