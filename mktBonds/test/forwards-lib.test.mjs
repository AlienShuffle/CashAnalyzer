import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
    beiSolverSA, binarySolver, daysBetween, easyForward, forwardNominalCleanPrice, forwardRate,
    forwardTipsCleanPrice, normalizeDate, tbillDiscountFactor, tbillSimpleRate,
} from "../lib/index.mjs";

const base = new Date(2020, 0, 1);
const refCpi = d => 260 + daysBetween(base, d) * 0.0085;
const factor = d => 1 + 0.003 * Math.cos((d.getMonth() + d.getDate() / 31) / 12 * 2 * Math.PI);
const n = normalizeDate;

test("forwardRate: flat curve gives the same rate; invalid rates throw", () => {
    assert.equal(forwardRate(0.04, 1, 0.04, 3), 0.04);
    assert.throws(() => forwardRate(-1, 1, 0.04, 2), /exceed/);
    assert.equal(easyForward("2026-10-05", "2027-01-05", "2027-01-05", 0.04, 0.04), null);
});

test("forward nominal price of a par bond with zero carry stays near par", () => {
    const p = forwardNominalCleanPrice({ settle: "2026-10-05", forward: "2026-12-01", maturity: "2031-02-15",
        coupon: 0.04, price: 100, repoRate: 0 });
    assert.ok(p < 100 && p > 98);
    assert.equal(forwardNominalCleanPrice({ settle: "2026-10-05", forward: "2032-01-01", maturity: "2031-02-15",
        coupon: 0.04, price: 100, repoRate: 0.04 }), null);
    assert.throws(() => forwardNominalCleanPrice({ settle: "2026-10-05", forward: "2026-01-01", maturity: "2031-02-15",
        coupon: 0.04, price: 100, repoRate: 0.04 }), /precede/);
});

test("tips forward price needs REFCPI for intervening coupons", () => {
    const args = { settle: "2026-10-05", forward: "2027-03-01", maturity: "2031-04-15", coupon: 0.0125, price: 97,
        datedRefCpi: 262, settleRefCpi: refCpi(n("2026-10-05")), forwardRefCpi: refCpi(n("2027-03-01")), repoRate: 0.04 };
    assert.throws(() => forwardTipsCleanPrice(args), /No published REFCPI/);
    assert.ok(forwardTipsCleanPrice({ ...args, getRefCpi: refCpi }) > 90);
});

test("tbill rates: bracketing and same-maturity average", () => {
    assert.throws(() => tbillDiscountFactor("2026-10-05", "2027-06-01", "2026-12-01", 99, "2027-03-01", 98), /bracketed/);
    assert.throws(() => tbillSimpleRate("2026-10-05", "2026-12-01", "2026-12-01", 99, "2026-12-01", 99.1 * 0), /Invalid/);
    const r = tbillSimpleRate("2026-10-05", "2026-12-01", "2026-12-01", 99, "2026-12-01", 99.2);
    assert.ok(r > 0.04 && r < 0.08);
});

test("binarySolver finds a root and rejects unbracketed ranges", () => {
    assert.ok(Math.abs(binarySolver(x => x - 0.05) - 0.05) < 1e-9);
    assert.throws(() => binarySolver(x => x + 1), /not bracketed/);
});

function loadAppsScript() {
    const dir = new URL("../appscript-src/", import.meta.url);
    const files = ["mybond.dates.js", "mybond.utils.js", "mybond.yieldFromPrice.js", "mybond.forwards.js",
        "mybond.calcForwardCP.js", "mybond.fwd.nom.calcFwdCP.js", "mybond.beiSolver.js", "discount.js", "fwd.tbill.calc.simple.js"];
    const context = vm.createContext({ Logger: { log() { } }, Math, Date, Array, Number });
    context.base = base;
    vm.runInContext(`
        function tipsGetRefCpi(d) { return 260 + mydateDaysBetween_(base, d) * 0.0085; }
        function tipsGetFactor(d) { return 1 + 0.003 * Math.cos((d.getMonth() + d.getDate() / 31) / 12 * 2 * Math.PI); }
    `, context);
    for (const file of files) vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    return context;
}

test("parity with Apps Script: forwards, bills and BEI", () => {
    const gs = loadAppsScript();
    let count = 0;
    for (const maturity of ["2027-04-15", "2029-07-15", "2031-04-15", "2036-01-15"]) {
        for (const forward of ["2026-12-01", "2027-03-01", "2027-06-15"]) {
            for (const coupon of [0, 0.00125, 0.0225]) {
                for (const repoRate of [0.03, 0.045]) {
                    const settle = "2026-10-05";
                    const nom = { settle, forward, maturity, coupon, price: 98.7, repoRate };
                    const nomOurs = forwardNominalCleanPrice(nom);
                    assert.equal(nomOurs === null ? "" : nomOurs,
                        gs.mybondCalcNominalForwardCP(settle, forward, maturity, coupon, 98.7, repoRate));
                    const tips = { settle, forward, maturity, coupon, price: 98.7, datedRefCpi: 262,
                        settleRefCpi: refCpi(n(settle)), forwardRefCpi: refCpi(n(forward)), repoRate, getRefCpi: refCpi };
                    const ours = forwardTipsCleanPrice(tips);
                    const theirs = gs.mybondCalcForwardCP(settle, forward, maturity, coupon, 98.7, 262,
                        tips.settleRefCpi, tips.forwardRefCpi, repoRate);
                    assert.equal(ours === null ? "" : ours, theirs === "" ? "" : theirs);
                    count++;
                }
            }
        }
    }
    assert.equal(count, 72);

    assert.equal(forwardRate(0.04, 0.5, 0.045, 2), gs.mybondForwardRate(0.04, 0.5, 0.045, 2));
    assert.equal(easyForward("2026-10-05", "2027-03-01", "2031-04-15", 0.04, 0.045),
        gs.mybondEasyForward("2026-10-05", "2027-03-01", "2031-04-15", 0.04, 0.045));
    assert.equal(easyForward("2026-10-05", "2027-03-01", "2027-03-01", 0.04, 0.045), null);
    assert.equal(gs.mybondEasyForward("2026-10-05", "2027-03-01", "2027-03-01", 0.04, 0.045), "");

    assert.equal(tbillDiscountFactor("2026-10-05", "2026-12-20", "2026-12-01", 99.1, "2027-03-01", 98.2),
        gs.myTbillDiscountFactor_("2026-10-05", "2026-12-20", "2026-12-01", 99.1, "2027-03-01", 98.2));
    assert.equal(tbillSimpleRate("2026-10-05", "2026-12-20", "2026-12-01", 99.1, "2027-03-01", 98.2),
        gs.myTbillSimpleRate("2026-10-05", "2026-12-20", "2026-12-01", 99.1, "2027-03-01", 98.2));
    assert.equal(tbillSimpleRate("2026-10-05", "2026-12-01", "2026-12-01", 99.1, "2026-12-01", 99.2),
        gs.myTbillSimpleRate("2026-10-05", "2026-12-01", "2026-12-01", 99.1, "2026-12-01", 99.2));

    for (const maturity of ["2027-04-15", "2028-07-15"]) {
        const a = { forward: "2026-12-01", maturity, coupon: 0.0125, cleanPrice: 99.2, datedREFCPI: 262,
            fwdREFCPI: refCpi(n("2026-12-01")), treasuryYield: 0.04 };
        const theirs = gs.mybondBEISolverSA(a.forward, a.maturity, a.coupon, a.cleanPrice, a.datedREFCPI, a.fwdREFCPI, a.treasuryYield);
        assert.equal(beiSolverSA({ ...a, getFactor: factor }), theirs);
    }
});
