import assert from "node:assert/strict";
import test from "node:test";
import { parseFundamentals, parsePercent } from "../factsParsing.mjs";

test("parses a numeric percentage and rejects selector labels", () => {
  assert.equal(parsePercent("6.10%"), 0.061);
  assert.equal(parsePercent(" 0.03% "), 0.0003);
  assert.equal(parsePercent("30 day SEC yield"), null);
  assert.equal(parsePercent(""), null);
});

test("parses fundamentals when labels and values have no whitespace between them", () => {
  const result = parseFundamentals(
    "Fundamentalsas of 10/08/2026DailyMonthlyFUNDAMENTALVTEB" +
    "Tax-equivalent yield47.38%Yield to worst4.65%" +
    "Average duration 7.4 (years)Average effective maturity13.9 (years)" +
    "Average coupon4.60%"
  );

  assert.deepEqual(result, {
    values: {
      yieldToWorst: 0.0465,
      durationYears: 7.4,
      maturityYears: 13.9,
      weightedAverageCoupon: 0.046
    },
    missing: ["Yield to maturity"]
  });
});

test("parses fundamentals with whitespace and rounds values to the established precision", () => {
  const result = parseFundamentals([
    "Yield to maturity 4.56789%",
    "Yield to worst 4.12345%",
    "Average duration 7.456 (years)",
    "Average effective maturity 13.987 (years)",
    "Average coupon 4.56789%"
  ].join("\n"));

  assert.deepEqual(result, {
    values: {
      durationYears: 7.46,
      yieldToMaturity: 0.0457,
      yieldToWorst: 0.0412,
      maturityYears: 13.99,
      weightedAverageCoupon: 0.04568
    },
    missing: []
  });
});
