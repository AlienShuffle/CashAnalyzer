import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
    daysBetween, normalizeDate, tipsNominalReturn, tipsNominalReturnTable,
    tipsPriceFromXirr, xirr,
} from "../lib/index.mjs";

const base = new Date(2020, 0, 1);
const refCpi = d => 260 + daysBetween(base, d) * 0.0085;
const factor = d => 1 + 0.003 * Math.cos((d.getMonth() + d.getDate() / 31) / 12 * 2 * Math.PI);
const lookups = { getRefCpi: refCpi, getFactor: factor };

function params(over = {}) {
    return {
        settle: "2026-10-05", forward: "2026-09-01", maturity: "2031-04-15",
        coupon: 0.0125, settleRealCP: 97.5, forwardRealCP: 97.1,
        datedREFCPI: 262, settleREFCPI: refCpi(normalizeDate("2026-10-05")),
        forwardREFCPI: refCpi(normalizeDate("2026-09-01")), inflator: 0.024, ...over,
    };
}

test("table: first flow is the negative dirty price; rate matches xirr of the flows", () => {
    const t = tipsNominalReturnTable({ ...params(), ...lookups });
    assert.ok(t.cashFlows[0] < 0);
    assert.equal(t.rate, xirr(t.cashFlows, t.dates, 0.10));
    assert.equal(t.rows.length, t.cashFlows.length - 1);
});

test("seasonal adjustment needs a factor lookup and changes the rate", () => {
    assert.throws(() => tipsNominalReturn({ ...params(), seasonal: true, getRefCpi: refCpi }), /seasonal factor/);
    const plain = tipsNominalReturn({ ...params(), ...lookups });
    const sa = tipsNominalReturn({ ...params(), ...lookups, seasonal: true });
    assert.notEqual(plain, sa);
});

test("tipsPriceFromXirr inverts the nominal XIRR (within rounding)", () => {
    const p = params();
    const t = tipsNominalReturnTable({ ...p, ...lookups });
    const settleIR = p.settleREFCPI / p.datedREFCPI;
    const future = t.rows.map(r => [r.date, r.cashflow]);
    const price = tipsPriceFromXirr(p.settle, p.maturity, p.coupon, t.rate, settleIR, future);
    assert.ok(Math.abs(price - p.settleRealCP) < 0.01, `price ${price}`);
    assert.equal(tipsPriceFromXirr(p.settle, p.maturity, p.coupon, null, settleIR, future), null);
    assert.throws(() => tipsPriceFromXirr(p.settle, p.maturity, p.coupon, 0.02, 0, future), /index ratio/);
    assert.throws(() => tipsPriceFromXirr(p.settle, p.maturity, p.coupon, 0.02, 1, []), /No TIPS/);
});

function loadAppsScript() {
    const dir = new URL("../appscript-src/", import.meta.url);
    const files = ["mybond.dates.js", "mybond.utils.js", "mybond.yieldFromPrice.js", "mybond.priceFromYield.js",
        "mybond.xirr.js", "mybond.xirr.Tips.js", "mybond.xirr.price.js"];
    const context = vm.createContext({ Logger: { log() { } }, Math, Date, Array, Number });
    context.base = base;
    vm.runInContext(`
        function tipsGetRefCpi(d) { return 260 + mydateDaysBetween_(base, d) * 0.0085; }
        function tipsGetFactor(d) { return 1 + 0.003 * Math.cos((d.getMonth() + d.getDate() / 31) / 12 * 2 * Math.PI); }
    `, context);
    for (const file of files) vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    return context;
}

test("parity with Apps Script: tips nominal return and price from xirr", () => {
    const gs = loadAppsScript();
    let n = 0;
    for (const maturity of ["2027-02-15", "2029-07-15", "2031-04-15", "2036-01-15", "2056-02-15"]) {
        for (const seasonal of [false, true]) {
            for (const coupon of [0.00125, 0.0225]) {
                for (const forwardRealCP of [97.1, null]) {
                    if (forwardRealCP === null && maturity > "2027") continue;
                    const p = params({ maturity, coupon, forwardRealCP });
                    const args = [p.settle, p.forward, p.maturity, p.coupon, p.settleRealCP, p.forwardRealCP,
                        p.datedREFCPI, p.settleREFCPI, p.forwardREFCPI, p.inflator, seasonal];
                    assert.equal(tipsNominalReturn({ ...p, seasonal, ...lookups }), gs.mybondTipsNominalReturn(...args), `${maturity} ${seasonal}`);
                    n++;
                }
            }
        }
    }
    assert.ok(n >= 20);

    const p = params();
    const t = tipsNominalReturnTable({ ...p, ...lookups });
    const settleIR = p.settleREFCPI / p.datedREFCPI;
    const future = t.rows.map(r => [r.date, r.cashflow]);
    assert.equal(
        tipsPriceFromXirr(p.settle, p.maturity, p.coupon, 0.045, settleIR, future),
        gs.mytipsPriceFromXirr(p.settle, p.maturity, p.coupon, 0.045, settleIR, future),
    );
});
