import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
    accruedInterest,
    bondFacts,
    couponSchedule,
    daysBetween,
    daysInYearFrom,
    macaulayDuration,
    modifiedDuration,
    normalizeDate,
    priceFromYield,
    roundYield,
    xirr,
    yieldFromPrice,
} from "../lib/index.mjs";

const d = s => normalizeDate(s);
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

test("daysBetween ignores DST transitions", () => {
    assert.equal(daysBetween(d("2026-03-01"), d("2026-04-01")), 31);
    assert.equal(daysBetween(d("2026-10-30"), d("2026-11-03")), 4);
});

test("daysInYearFrom is 366 when the following year spans Feb 29", () => {
    assert.equal(daysInYearFrom(d("2027-10-05")), 366);
    assert.equal(daysInYearFrom(d("2026-10-05")), 365);
    assert.equal(daysInYearFrom(d("2023-03-15")), 366);
    assert.equal(daysInYearFrom(d("2023-01-15")), 365);
});

test("couponSchedule clamps to month end and includes settle-day coupons", () => {
    const schedule = couponSchedule("2026-10-15", "2028-04-30").map(iso);
    assert.deepEqual(schedule, ["2026-10-30", "2027-04-30", "2027-10-30", "2028-04-30"]);
    assert.equal(iso(couponSchedule("2026-10-15", "2028-10-15")[0]), "2026-10-15");
});

test("bondFacts and accruedInterest agree on a mid-period settle", () => {
    const facts = bondFacts("2026-12-15", "2030-10-15");
    assert.equal(iso(facts.lastCoupon), "2026-10-15");
    assert.equal(iso(facts.nextCoupon), "2027-04-15");
    assert.equal(facts.A, 61);
    assert.equal(facts.E, 182);
    assert.equal(facts.A + facts.DSC, facts.E);
    assert.equal(accruedInterest("2026-12-15", "2030-10-15", 0.05), 0.837912);
});

test("par bond on a coupon date yields its coupon", () => {
    assert.equal(yieldFromPrice("2026-10-15", "2030-10-15", 0.05, 100), 0.05);
    assert.equal(priceFromYield("2026-10-15", "2030-10-15", 0.05, 0.05), 100);
});

test("short zero-coupon uses the investment-rate formula", () => {
    // 90 days, 365-day year: (100/99 - 1) / (90/365)
    const expected = roundYield((100 / 99 - 1) / (90 / 365));
    assert.equal(yieldFromPrice("2026-10-05", "2027-01-03", 0, 99), expected);
    assert.equal(yieldFromPrice("2026-10-05", "2027-01-03", null, 99), expected);
});

test("yieldFromPrice returns null for degenerate inputs", () => {
    assert.equal(yieldFromPrice("2026-10-05", "2026-10-05", 0.04, 100), null);
    assert.equal(yieldFromPrice("2026-10-05", "2026-09-01", 0.04, 100), null);
    assert.equal(yieldFromPrice("2026-10-05", "2030-10-15", 0.04, 0), null);
    assert.equal(priceFromYield("2026-10-05", "2030-10-15", 0.04, null), null);
    assert.equal(priceFromYield("2026-10-05", "2026-01-15", 0.04, 0.04), null);
});

test("price -> yield round trip", () => {
    for (const [maturity, coupon, yld] of [
        ["2027-01-15", 0.045, 0.039],
        ["2030-10-15", 0.0375, 0.0412],
        ["2036-08-15", 0.0425, 0.0455],
        ["2056-02-15", 0.05, 0.047],
        ["2028-02-29", 0.03, 0.035],
    ]) {
        const price = priceFromYield("2026-10-05", maturity, coupon, yld);
        assert.ok(Math.abs(yieldFromPrice("2026-10-05", maturity, coupon, price) - yld) < 2e-6,
            `${maturity} ${coupon} ${yld}`);
    }
});

test("duration: zero coupon equals time to maturity and modified is smaller", () => {
    const macaulay = macaulayDuration("2026-10-15", "2030-10-15", 0, 0.04);
    assert.ok(Math.abs(macaulay - 4) < 0.02, `macaulay=${macaulay}`);
    assert.ok(modifiedDuration("2026-10-15", "2030-10-15", 0, 0.04) < macaulay);
    assert.equal(macaulayDuration("2026-10-15", "2026-10-15", 0.04, 0.04), null);
});

test("xirr solves a simple two-flow case and validates input", () => {
    const rate = xirr([-100, 105], ["2026-01-01", "2027-01-01"]);
    assert.equal(rate, 0.05);
    assert.throws(() => xirr([100, 105], ["2026-01-01", "2027-01-01"]), /positive and one negative/);
    assert.throws(() => xirr([-100, 105], ["2027-01-01", "2026-01-01"]), /ascending/);
    assert.throws(() => xirr([-100], ["2026-01-01", "2027-01-01"]), /same length/);
});

// Parity against the maintained toolkit sources, run unmodified in a vm sandbox.
function loadAppsScript() {
    const dir = new URL("../toolkit-app-script-src/", import.meta.url);
    const files = ["mybond._dates.js", "mybond._utils.js", "mybond.accrued.js", "mybond.yieldFromPrice.js",
        "mybond.priceFromYield.js", "mybond.duration.js", "mybond.xirr.js"];
    const context = vm.createContext({ Logger: { log() { } }, Math, Date });
    for (const file of files) {
        vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    }
    return context;
}

test("parity with the toolkit Apps Script implementation", () => {
    const gs = loadAppsScript();
    const settles = ["2026-10-05", "2026-12-31", "2027-03-01"];
    const maturities = ["2027-02-15", "2027-10-05", "2028-02-29", "2029-05-31", "2031-11-15", "2036-08-15", "2056-02-15"];
    const coupons = [0, 0.0125, 0.03, 0.045];
    const prices = [92, 99.5, 100, 101.25];
    let compared = 0;

    for (const settle of settles) {
        for (const maturity of maturities) {
            for (const coupon of coupons) {
                for (const price of prices) {
                    const s = d(settle), m = d(maturity);
                    if (m <= s) continue;
                    assert.equal(yieldFromPrice(s, m, coupon, price), gs.myYieldFromPrice(s, m, coupon, price),
                        `yield ${settle} ${maturity} ${coupon} ${price}`);
                    const y = yieldFromPrice(s, m, coupon, price);
                    assert.equal(priceFromYield(s, m, coupon, y), gs.myPriceFromYield(s, m, coupon, y),
                        `price ${settle} ${maturity} ${coupon} ${y}`);
                    assert.equal(macaulayDuration(s, m, coupon, y), gs.mybondCalcDuration(s, m, coupon, y),
                        `duration ${settle} ${maturity} ${coupon} ${y}`);
                    assert.equal(modifiedDuration(s, m, coupon, y), gs.mybondCalcMDuration(s, m, coupon, y),
                        `mduration ${settle} ${maturity} ${coupon} ${y}`);
                    assert.equal(accruedInterest(s, m, coupon), gs.mybondAccruedInterest(s, m, coupon));
                    compared++;
                }
            }
        }
    }
    assert.ok(compared > 300, `only compared ${compared}`);

    const flows = [-1000, 30, 30, 1030];
    const dates = ["2026-10-05", "2027-04-05", "2027-10-05", "2028-04-05"].map(d);
    assert.equal(xirr(flows, dates), gs.mybondXIRR(flows, dates));
});
