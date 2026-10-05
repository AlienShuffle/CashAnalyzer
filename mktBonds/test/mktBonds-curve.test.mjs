import test from "node:test";
import assert from "node:assert/strict";
import { accruedInterest } from "../lib/coupons.mjs";
import { svenssonZero, tipsZeroModelPrice } from "../lib/zero/index.mjs";
import { buildNominalCurveAnalysis, parseOptions } from "../node-calc-mktBonds-curve.mjs";

const params = [0.05, -0.01, 0.01, 0.01, 2, 8];
const settle = "2026-10-06";
const context = { asOfDate: "2026-10-05T1235", settleDate: settle, forwardDate: "2026-11-01", repoRate: 0.04 };

function quote(maturity, coupon, extra = {}) {
    const clean = tipsZeroModelPrice(settle, maturity, coupon, params) - accruedInterest(settle, maturity, coupon);
    return {
        asOfDate: context.asOfDate, cusip: `C${maturity}`, securitytype: "Bond", rate: String(coupon), maturitydate: maturity,
        bid: clean - 0.05, ask: clean, description: `UNITED STATES TREAS NTS, ${coupon}`, ...extra,
    };
}

const quotes = [];
for (let year = 2027; year <= 2056; year++) {
    for (const md of ["02-15", "08-15"]) quotes.push(quote(`${year}-${md}`, 0.04));
}

test("nominal curve recovers a synthetic Svensson curve at 6-month points to 30 years", () => {
    const result = buildNominalCurveAnalysis(quotes, context);
    assert.equal(result.basis, "settle");
    assert.equal(result.points.length, 60);
    assert.equal(result.points[0].term, 0.5);
    assert.equal(result.points[0].date, "2027-04-06");
    assert.equal(result.points[59].term, 30);
    assert.equal(result.points[59].date, "2056-10-06");
    for (const p of result.points.filter(pt => pt.term >= 2)) {
        const years = (new Date(p.date) - new Date(settle)) / 86400000 / 365;
        assert.ok(Math.abs(p.zeroCc - svenssonZero(years, params)) < 0.0005, `zero at ${p.term}`);
    }
    const p = result.points[3];
    assert.ok(p.zeroBey > p.zeroCc && p.discountFactor < 1);
});

test("STRIPs, TIPS, bonds maturing by the forward date and bad quotes are left out", () => {
    const strip = quote("2040-08-15", 0, { cusip: "STRIPP", description: "UNITED STATES TREAS BD STRIPP ZERO CPN, 0.000%, 15-AUG-2040" });
    const tips = quote("2040-02-15", 0.01, { cusip: "TIPS", securitytype: "TIPS" });
    const early = quote("2026-10-31", 0.04, { cusip: "EARLY" });
    const bad = quote("2036-02-15", 0.04, { cusip: "BAD", ask: 80 });
    const result = buildNominalCurveAnalysis([...quotes, strip, tips, early, bad], context);
    assert.deepEqual(result.excluded.map(e => e.cusip), ["BAD"]);
    assert.equal(result.bondsUsed, quotes.length);
});

test("forward basis curves start at the forward date and need a repo rate", () => {
    const result = buildNominalCurveAnalysis(quotes, context, { basis: "forward" });
    assert.equal(result.settleDate, "2026-11-01");
    assert.equal(result.points[0].date, "2027-05-01");
    assert.throws(() => buildNominalCurveAnalysis(quotes, { ...context, repoRate: NaN }, { basis: "forward" }), /repo rate/);
});

test("nominal curve options are validated", () => {
    assert.equal(parseOptions("--basis=forward --priceSide=bid").basis, "forward");
    assert.throws(() => parseOptions("--basis=x"), /basis/);
    assert.throws(() => parseOptions("--nope=1"), /Unknown option/);
});
