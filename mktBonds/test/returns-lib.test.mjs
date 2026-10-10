import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
    accruedInterest, daysBetween, normalizeDate, roundPrice, tipsNominalReturn, tipsNominalReturnTable,
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
    const dir = new URL("../../fintools/lib/", import.meta.url);
    const files = ["mybond._dates.js", "mybond._utils.js", "mybond.accrued.js", "mybond.yieldFromPrice.js",
        "mybond.xirr.js", "mybond.xirr.Tips.js", "mybond.xirr.Nominal.js", "mybond.xirr.price.js"];
    const context = vm.createContext({ Logger: { log() { } }, Math, Date, Array, Number });
    context.base = base;
    vm.runInContext(`
        function tipsGetRefCpi(d) { return 260 + mydateDaysBetween_(base, d) * 0.0085; }
        function tipsGetFactor(d) { return 1 + 0.003 * Math.cos((d.getMonth() + d.getDate() / 31) / 12 * 2 * Math.PI); }
    `, context);
    for (const file of files) vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    return context;
}

test("TIPS settlement, coupon attribution and cash flows match fintools", () => {
    const gs = loadAppsScript();
    const fields = ["cashflow", "cumKnownInflation", "cumFutureInflation", "cumCoupon",
        "cumDiscount", "cumSA", "currKnownInflation", "currFutureInflation",
        "currCoupon", "currDiscount", "currSA"];
    for (const settle of ["2026-10-05", "2026-10-15"]) {
        for (const coupon of [0, 0.0125]) {
            for (const forward of ["2026-09-01", "2027-06-01"]) {
                for (const seasonal of [false, true]) {
                    const p = params({ settle, coupon, forward, seasonal,
                        settleREFCPI: refCpi(normalizeDate(settle)),
                        forwardREFCPI: refCpi(normalizeDate(forward)) });
                    const t = tipsNominalReturnTable({ ...p, ...lookups });
                    const args = [p.settle, p.forward, p.maturity, p.coupon, p.settleRealCP,
                        p.forwardRealCP, p.datedREFCPI, p.settleREFCPI, p.forwardREFCPI, p.inflator, seasonal];
                    const graph = gs.mybondGraphTipsNominalReturn(...args);
                    const dated = graph.filter(row => row[0] instanceof Date);
                    const accrued = roundPrice(p.settleREFCPI / p.datedREFCPI *
                        accruedInterest(p.settle, p.maturity, coupon));
                    assert.equal(t.settlementRow.currCoupon, -accrued);
                    assert.equal(t.settlementRow.cumCoupon, -accrued);
                    assert.equal(t.settlementRow.date.getTime(), dated[0][0].getTime());
                    assert.equal(t.settlementRow.cashflow, dated[0][1]);
                    assert.equal(t.settlementRow.cumCoupon, dated[0][4]);
                    assert.equal(t.settlementRow.currCoupon, dated[0][9]);
                    assert.equal(t.rows.length, dated.length - 1);
                    for (let i = 0; i < t.rows.length; i++) {
                        assert.equal(t.rows[i].date.getTime(), dated[i + 1][0].getTime());
                        for (const [column, field] of fields.entries()) {
                            assert.equal(t.rows[i][field], dated[i + 1][column + 1], `${field}, row ${i}`);
                        }
                    }
                    const totals = graph.find(row => row[0] === "irr/totals");
                    for (const [i, field] of fields.slice(1, 6).entries()) {
                        assert.equal(t.totals[field], totals[i + 2], field);
                    }
                    assert.deepEqual(t.cashFlows, Array.from(dated, row => row[1]));
                    assert.equal(t.rate, gs.mybondTipsNominalReturn(...args));
                }
            }
        }
    }
});

test("fintools Nominal and TIPS use the same settlement attribution at unit index ratio", () => {
    const gs = loadAppsScript();
    gs.tipsGetRefCpi = () => 100;
    for (const settle of ["2026-10-05", "2026-10-15"]) {
        for (const coupon of [0, 0.0125]) {
            const nominal = gs.mybondGraphTreasuryReturn(settle, "2031-04-15", coupon, 97.5);
            const tips = gs.mybondGraphTipsNominalReturn(settle, "2026-09-01", "2031-04-15",
                coupon, 97.5, 97.5, 100, 100, 100, 0, false);
            const nominalRows = nominal.filter(row => row[0] instanceof Date);
            const tipsRows = tips.filter(row => row[0] instanceof Date);
            assert.equal(nominalRows.length, tipsRows.length);
            for (let i = 0; i < nominalRows.length; i++) {
                assert.equal(nominalRows[i][1], tipsRows[i][1]);
                assert.equal(nominalRows[i][2], tipsRows[i][4]);
                assert.equal(nominalRows[i][4], tipsRows[i][9]);
            }
            assert.equal(nominal.find(row => row[0] === "irr/totals")[1],
                tips.find(row => row[0] === "irr/totals")[1]);
        }
    }
});

test("parity with fintools Apps Script: tips nominal return and price from xirr", () => {
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
