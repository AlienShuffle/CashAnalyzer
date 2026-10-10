import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { accruedInterest } from "../lib/coupons.mjs";
import {
    analyzeTipsZero, dfToSimpleRate, dfToZeroBEY, dfToZeroCc, fitTipsSvensson, forwardCcFromDF, forwardCarryFactor,
    forwardDF, simpleRateToDF, svenssonDF, svenssonZero, tipsZeroModelPrice, zeroBEYToCc, zeroBEYToDF, zeroCcToBEY,
    zeroCcToDF,
} from "../lib/index.mjs";

test("zero conversions round-trip", () => {
    assert.equal(zeroCcToDF(0.05, 0), 1);
    assert.ok(Math.abs(dfToZeroCc(zeroCcToDF(0.05, 3), 3) - 0.05) < 1e-12);
    assert.ok(Math.abs(zeroBEYToCc(zeroCcToBEY(0.05)) - 0.05) < 1e-12);
    assert.ok(Math.abs(dfToZeroBEY(zeroBEYToDF(0.04, 5), 5) - 0.04) < 1e-12);
    assert.ok(Math.abs(dfToSimpleRate(simpleRateToDF(0.04, 90, 365), 90, 365) - 0.04) < 1e-12);
    assert.ok(Math.abs(forwardCcFromDF(zeroCcToDF(0.04, 1), zeroCcToDF(0.04, 3), 1, 3) - 0.04) < 1e-12);
    assert.equal(forwardDF(0.5, 0.25) * forwardCarryFactor(0.5, 0.25), 1);
});

test("zero conversions validate inputs", () => {
    assert.throws(() => zeroCcToDF(0.05, -1), /negative/);
    assert.throws(() => dfToZeroCc(0, 1), /positive/);
    assert.throws(() => zeroBEYToCc(-2), /Invalid/);
    assert.throws(() => forwardCcFromDF(0.9, 0.8, 2, 1), /greater/);
});

test("svensson: flat curve and t<=0", () => {
    const p = [0.02, 0, 0, 0, 1.5, 6];
    assert.equal(svenssonZero(5, p), 0.02);
    assert.equal(svenssonZero(0, [0.02, -0.005, 0, 0, 1, 2]), 0.015);
    assert.ok(Math.abs(svenssonDF(2, p) - Math.exp(-0.04)) < 1e-12);
    const price = tipsZeroModelPrice("2026-10-05", "2029-04-15", 0.02, p);
    assert.ok(price > 95 && price < 105);
});

const settle = "2026-10-05";
const bonds = [
    ["2027-04-15", 0.0125, 99.6], ["2027-10-15", 0.01, 99.2], ["2028-07-15", 0.0075, 98.0],
    ["2029-01-15", 0.0125, 98.4], ["2030-07-15", 0.015, 97.9], ["2031-04-15", 0.0125, 96.5],
    ["2032-07-15", 0.02, 98.1], ["2035-01-15", 0.02, 96.0],
].map(([maturity, coupon, cleanPrice]) => ({ maturity, coupon, cleanPrice }));

test("fit requires at least 6 bonds and analysis reports a row per active bond", () => {
    assert.throws(() => fitTipsSvensson(settle, bonds.slice(0, 3)), /at least 6/);
    const r = analyzeTipsZero(settle, bonds);
    assert.deepEqual(Object.keys(r), ["params", "objective", "rows"]);
    assert.equal(r.rows.length, bonds.length);
    assert.equal(r.params.length, 6);
    assert.ok(r.rows.every(x => Math.abs(x.priceResidual) < 1));
});

test("TIPS zero analysis excludes bonds matured by settlement", () => {
    const matured = [
        { maturity: "2026-10-04", coupon: NaN, cleanPrice: 0 },
        { maturity: settle, coupon: NaN, cleanPrice: 0 },
    ];
    const r = analyzeTipsZero(settle, [...matured, ...bonds]);
    assert.equal(r.rows.length, bonds.length);
    assert.ok(r.rows.every(row => row.maturity > new Date(2026, 9, 5)));
});

test("Svensson fit meets the forward-curve price-error threshold", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures-tips-forward-curve.json", import.meta.url), "utf8"));
    const market = fixture.bonds.map(([maturity, coupon, cleanPrice]) => ({ maturity, coupon, cleanPrice }));
    const fit = fitTipsSvensson(fixture.settle, market);
    assert.ok(fit.objective < 0.72);
    assert.ok(fit.params[4] < fit.params[5]);
});

test("optimized Svensson fit reprices a synthetic curve", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures-tips-forward-curve.json", import.meta.url), "utf8"));
    const truth = [0.021, -0.006, 0.01, 0.015, 1.8, 9];
    const synthetic = fixture.bonds.map(([maturity, coupon]) => ({
        maturity,
        coupon,
        cleanPrice: tipsZeroModelPrice(fixture.settle, maturity, coupon, truth) - accruedInterest(fixture.settle, maturity, coupon),
    }));
    const fit = fitTipsSvensson(fixture.settle, synthetic);
    assert.ok(fit.objective < 1e-8, `${fit.objective}`);
});

function loadFintools() {
    const dir = new URL("../../fintools/lib/", import.meta.url);
    const context = vm.createContext({ Date, Math, Logger: { log() { } } });
    for (const file of ["mybond._dates.js", "mybond._utils.js", "mybond.accrued.js",
        "mybond.yieldFromPrice.js", "mybond.duration.js", "mybond.zero-coupon.js"]) {
        vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    }
    return context;
}

function assertFitParity(actual, expected) {
    assert.deepEqual(Object.keys(actual), ["params", "objective"]);
    assert.deepEqual(Array.from(actual.params), expected.params);
    assert.equal(actual.objective, expected.objective);
    assert.ok(actual.params.every(Number.isFinite));
    assert.ok(Number.isFinite(actual.objective));
    assert.ok(actual.params[4] >= 0.1 && actual.params[4] <= 15);
    assert.ok(actual.params[5] >= 0.5 && actual.params[5] <= 60);
    assert.ok(actual.params[5] >= actual.params[4] * 1.05);
}

test("fintools Svensson matches Node parameters, objective and forward-fit threshold", () => {
    const gs = loadFintools();
    const fixture = JSON.parse(readFileSync(new URL("./fixtures-tips-forward-curve.json", import.meta.url), "utf8"));
    const market = fixture.bonds.map(([maturity, coupon, cleanPrice]) => ({ maturity, coupon, cleanPrice }));
    const expected = fitTipsSvensson(fixture.settle, market);
    const fit = gs.fitTipsSvensson_(fixture.settle, market);
    assertFitParity(fit, expected);
    assert.ok(fit.objective < 0.72, `${fit.objective}`);
    assertFitParity(gs.fitTipsSvensson_(fixture.settle, market), expected);
    for (const bond of market) {
        assert.equal(gs.mytipsZeroModelPrice(fixture.settle, bond.maturity, bond.coupon, fit.params),
            tipsZeroModelPrice(fixture.settle, bond.maturity, bond.coupon, expected.params));
    }
});

test("fintools Svensson reprices a synthetic curve with Node fit quality", () => {
    const gs = loadFintools();
    const truth = [0.021, -0.006, 0.01, 0.015, 1.8, 9];
    const synthetic = bonds.map(bond => ({
        ...bond,
        cleanPrice: tipsZeroModelPrice(settle, bond.maturity, bond.coupon, truth) -
            accruedInterest(settle, bond.maturity, bond.coupon),
    }));
    const fit = gs.fitTipsSvensson_(settle, synthetic);
    assertFitParity(fit, fitTipsSvensson(settle, synthetic));
    assert.ok(fit.objective < 1e-8, `${fit.objective}`);
});

test("fintools Svensson preserves usable-bond validation and excludes matured bonds", () => {
    const gs = loadFintools();
    for (const input of [null, [], bonds.slice(0, 3)]) {
        assert.throws(() => gs.fitTipsSvensson_(settle, input), /at least 6 bonds/);
    }
    const unusable = bonds.map(bond => ({ ...bond, cleanPrice: 0 }));
    assert.throws(() => gs.fitTipsSvensson_(settle, unusable), /Insufficient usable bonds/);
    const mixed = [
        { maturity: "2026-10-04", coupon: 0.01, cleanPrice: 100 },
        { maturity: settle, coupon: 0.01, cleanPrice: 100 },
        { maturity: "2030-01-15", coupon: NaN, cleanPrice: 100 },
        ...bonds,
    ];
    assertFitParity(gs.fitTipsSvensson_(settle, mixed), fitTipsSvensson(settle, bonds));
});

test("fintools spreadsheet zero analysis retains table shape and reprices the Node fit", () => {
    const gs = loadFintools();
    const result = gs.mybondsZeroAnalyze(settle, bonds.map(b => [b.maturity]),
        bonds.map(b => [b.coupon]), bonds.map(b => [b.cleanPrice]));
    const expected = analyzeTipsZero(settle, bonds);
    assert.equal(result.length, bonds.length + 1);
    assert.ok(result.every(row => row.length === 8));
    assert.deepEqual(Array.from(result[0]), ["Maturity", "Coupon", "Market Clean",
        "Model Clean", "Price Residual", "Market YTM", "Model YTM", "Residual (bp)"]);
    for (let i = 0; i < bonds.length; i++) {
        assert.equal(result[i + 1][3], expected.rows[i].modelClean);
        assert.equal(result[i + 1][4], expected.rows[i].priceResidual);
        assert.equal(result[i + 1][5], expected.rows[i].marketYtm);
        assert.equal(result[i + 1][6], expected.rows[i].modelYtm);
        assert.equal(result[i + 1][7], expected.rows[i].residualBp);
    }
});
