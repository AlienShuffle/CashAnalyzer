import test from "node:test";
import assert from "node:assert/strict";
import { nextWeekday, createRefCpiTable, tbillRepoRate } from "../lib/index.mjs";
import { nominalZeroYtm } from "../lib/zero/index.mjs";
import { yieldFromPrice } from "../lib/yield.mjs";
import { buildTipsCurveAnalysis } from "../node-calc-mktTips-curve.mjs";
import { buildTipsRows, parseMeta, parseOptions } from "../node-mktTips-update.mjs";

test("nextWeekday skips weekends", () => {
    const iso = d => d.toISOString().slice(0, 10);
    const utc = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    assert.equal(iso(utc(nextWeekday("2026-10-02"))), "2026-10-05");
    assert.equal(iso(utc(nextWeekday("2026-10-05"))), "2026-10-06");
});

test("parseOptions defaults and validation", () => {
    assert.equal(parseOptions("").repoRate, "auto");
    assert.equal(parseOptions("--repoRate=0.05").repoRate, 0.05);
    assert.equal(parseOptions("--repoRate=0.05 --priceSide=bid").priceSide, "bid");
    assert.throws(() => parseOptions("--priceSide=mid"), /ask or bid/);
    assert.throws(() => parseOptions("--bogus=1"), /Unknown/);
});

test("buildTipsRows joins quotes, picks the price side and skips unquoted bonds", () => {
    const meta = parseMeta('"cusip","interest_rate","security_term","series","maturity_date","dated_date","ref_cpi_on_dated_date"\n' +
        '"AAA",0.0125,10,"X","2030-07-15","2020-07-15",260.0\n"BBB",0.01,5,"Y","2030-07-15","2020-07-15",260.0\n');
    const rows = [];
    for (let d = new Date(2026, 9, 1); d <= new Date(2026, 10, 1); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        rows.push({ date: d, refCpiNSA: 330 + rows.length * 0.1, saFactor: 1 });
    }
    const table = createRefCpiTable(rows);
    const quotes = [{ cusip: "AAA", securitytype: "TIPS", asOfDate: "2026-10-02T1405", bid: "98.0", ask: "98.1" }];
    const out = buildTipsRows(meta, quotes, table, { repoRate: 0.04, priceSide: "bid" });
    assert.equal(out.length, 1);
    assert.equal(out[0].settle_clean_price, 98);
    assert.equal(out[0].report_source, "Market bid");
    assert.equal(buildTipsRows(meta, quotes, table, { repoRate: 0.04, priceSide: "ask" })[0].report_source, "Market ask");
    assert.equal(out[0].settle_date, "2026-10-05");
    assert.equal(out[0].fwd_date, "2026-11-01");
    assert.ok(out[0].fwd_clean_price_unadjusted > 90);
    assert.ok("fwd_mature_sa_ratio_decay" in out[0]);
    assert.equal(out[0].settle_ytm, yieldFromPrice(out[0].settle_date, out[0].maturity_date, out[0].interest_rate, out[0].settle_clean_price));
    assert.equal(out[0].settle_sa_ytm, yieldFromPrice(out[0].settle_date, out[0].maturity_date, out[0].interest_rate, out[0].settle_clean_price * out[0].settle_mature_sa_ratio));
    assert.equal(out[0].settle_sa_decay_ytm, yieldFromPrice(out[0].settle_date, out[0].maturity_date, out[0].interest_rate, out[0].settle_clean_price * out[0].settle_mature_sa_ratio_decay));
    assert.equal(out[0].forward_ytm, yieldFromPrice(out[0].fwd_date, out[0].maturity_date, out[0].interest_rate, out[0].fwd_clean_price_unadjusted));
    assert.equal(out[0].forward_sa_ytm, yieldFromPrice(out[0].fwd_date, out[0].maturity_date, out[0].interest_rate, out[0].fwd_clean_price_unadjusted * out[0].fwd_mature_sa_ratio));
    assert.equal(out[0].forward_sa_decay_ytm, yieldFromPrice(out[0].fwd_date, out[0].maturity_date, out[0].interest_rate, out[0].fwd_clean_price_unadjusted * out[0].fwd_mature_sa_ratio_decay));
});

test("tbillRepoRate brackets the target and derives a simple rate; auto repo is used in rows", () => {
    const bills = [["2026-10-29", 99.743], ["2026-11-03", 99.687], ["2026-11-10", 99.613]]
        .map(([maturity, price]) => ({ maturity, price }));
    const r = tbillRepoRate("2026-10-05", "2026-11-01", bills);
    assert.equal(r.before.maturity.getDate(), 29);
    assert.equal(r.after.maturity.getDate(), 3);
    assert.ok(r.rate > 0.03 && r.rate < 0.06);
    assert.throws(() => tbillRepoRate("2026-10-05", "2026-12-01", bills), /bracket/);
});

test("TIPS curve analysis is generated as a separate dated Svensson result", () => {
    const curveRows = [
        ["2027-04-15", 0.0125, 99.6], ["2027-10-15", 0.01, 99.2], ["2028-07-15", 0.0075, 98.0],
        ["2029-01-15", 0.0125, 98.4], ["2030-07-15", 0.015, 97.9], ["2031-04-15", 0.0125, 96.5],
        ["2032-07-15", 0.02, 98.1], ["2035-01-15", 0.02, 96.0],
    ].map(([maturity_date, interest_rate, settle_clean_price]) => ({
        cusip: `CUSIP-${maturity_date}`,
        asOfDate: "2026-10-02T1405",
        settle_date: "2026-10-05",
        fwd_date: "2026-12-01",
        maturity_date,
        interest_rate,
        settle_clean_price,
        fwd_clean_price_unadjusted: settle_clean_price + 0.1,
        settle_mature_sa_ratio: 1.03,
        fwd_mature_sa_ratio: 1.01,
        fwd_mature_sa_ratio_decay: 1.02,
    }));
    curveRows.unshift({
        asOfDate: "2026-10-02T1405",
        cusip: "MATURED",
        settle_date: "2026-10-05",
        fwd_date: "2026-12-01",
        maturity_date: "2026-10-04",
        interest_rate: NaN,
        settle_clean_price: 0,
    });

    const result = buildTipsCurveAnalysis(curveRows);
    assert.equal(result.method, "Svensson");
    assert.equal(result.asOfDate, "2026-10-02T1405");
    assert.equal(result.settleDate, "2026-10-05");
    assert.equal(result.params.length, 6);
    assert.equal(result.rows.length, 8);
    assert.equal(Object.keys(result.rows[0])[0], "cusip");
    assert.equal(result.rows[0].cusip, "CUSIP-2027-04-15");
    assert.ok(result.rows.every(row => row.maturity > result.settleDate));
    assert.equal(result.basis, "settle");

    // A bond maturing between settlement and the forward date is excluded from both curves.
    const early = { ...curveRows[1], cusip: "EARLY", maturity_date: "2026-11-15" };
    for (const basis of ["settle", "forward"]) {
        const r = buildTipsCurveAnalysis([early, ...curveRows], { basis });
        assert.ok(!r.rows.some(row => row.cusip === "EARLY"));
        assert.equal(r.rows.length, 8);
    }

    assert.ok(result.rows.every(r => r.richCheap === (Math.abs(r.residualBp) < 2 ? "" : r.residualBp > 0 ? "cheap" : "rich")));
    const fwd = buildTipsCurveAnalysis(curveRows, { basis: "forward" });
    assert.equal(fwd.basis, "forward");
    assert.equal(fwd.settleDate, "2026-12-01");
    assert.ok(Math.abs(fwd.rows[0].marketClean - 99.7) < 1e-9);
    const sa = buildTipsCurveAnalysis(curveRows, { basis: "forward-sa" });
    assert.equal(sa.basis, "forward-sa");
    assert.equal(sa.settleDate, "2026-12-01");
    assert.ok(Math.abs(sa.rows[0].marketClean - 99.7 * 1.01) < 1e-9);
    const settleSa = buildTipsCurveAnalysis(curveRows, { basis: "settle-sa" });
    assert.equal(settleSa.settleDate, "2026-10-05");
    assert.ok(Math.abs(settleSa.rows[0].marketClean - 99.6 * 1.03) < 1e-9);
    const decay = buildTipsCurveAnalysis(curveRows, { basis: "forward-sa-decay" });
    assert.equal(decay.basis, "forward-sa-decay");
    assert.ok(Math.abs(decay.rows[0].marketClean - 99.7 * 1.02) < 1e-9);
    // Bonds without a seasonal ratio are left out of the adjusted curve only.
    const noRatio = { ...curveRows[1], cusip: "NORATIO", fwd_mature_sa_ratio: null };
    assert.ok(!buildTipsCurveAnalysis([noRatio, ...curveRows], { basis: "forward-sa" }).rows.some(r => r.cusip === "NORATIO"));
    assert.ok(buildTipsCurveAnalysis([noRatio, ...curveRows], { basis: "forward" }).rows.some(r => r.cusip === "NORATIO"));
    assert.throws(() => buildTipsCurveAnalysis(curveRows, { basis: "x" }), /basis/);
});

test("nominal model and market yields are added from the nominal curve", () => {
    const flat = [0.04, 0, 0, 0, 2, 8];
    const fitBonds = [2027, 2029, 2031, 2033, 2035, 2037, 2040].map(y => ({ cusip: `N${y}`, maturity: `${y}-01-15`, coupon: 0.04, ytm: 0.04 + (y - 2027) * 0.001 }));
    const rows = [
        ["2029-01-15", 0.0125, 98.4], ["2030-07-15", 0.015, 97.9], ["2031-04-15", 0.0125, 96.5],
        ["2032-07-15", 0.02, 98.1], ["2033-01-15", 0.02, 96.0], ["2035-01-15", 0.02, 96.0],
    ].map(([maturity_date, interest_rate, settle_clean_price]) => ({
        cusip: maturity_date, asOfDate: "2026-10-02T1405", settle_date: "2026-10-05", fwd_date: "2026-12-01",
        maturity_date, interest_rate, settle_clean_price,
    }));
    const plain = buildTipsCurveAnalysis(rows);
    assert.ok(plain.rows.every(r => !("nominalModelYtm" in r)));
    const nominalCurve = { settleDate: "2026-10-05", params: flat, fitBonds };
    const result = buildTipsCurveAnalysis(rows, { nominalCurve });
    for (const [i, r] of result.rows.entries()) {
        // A matched-coupon bond on a flat 4% continuous curve yields about 4.04% semiannual.
        assert.ok(Math.abs(r.nominalModelYtm - 0.0404) < 0.0005, r.maturity);
        assert.equal(r.nominalModelYtm, Math.round(nominalZeroYtm("2026-10-05", r.maturity, rows[i].interest_rate, flat) * 1e5) / 1e5);
        // Observed yields rise 10 bp a year (one grid bond every two years) on this grid, so the local fit recovers that line.
        const years = (new Date(r.maturity) - new Date("2026-10-05")) / 86400000 / 365;
        const expected = 0.04 + (years - (new Date("2027-01-15") - new Date("2026-10-05")) / 86400000 / 365) * 0.001;
        assert.ok(Math.abs(r.nominalMarketYtm - expected) < 0.0005, `${r.maturity} ${r.nominalMarketYtm} ${expected}`);
    }
    const outside = buildTipsCurveAnalysis(rows, { nominalCurve: { ...nominalCurve, fitBonds: fitBonds.slice(0, 2) } });
    for (const r of result.rows) {
        assert.equal(r.marketBei, Math.round((r.nominalMarketYtm - r.marketYtm) * 1e5) / 1e5);
        assert.equal(r.modelBei, Math.round((r.nominalModelYtm - r.modelYtm) * 1e5) / 1e5);
    }
    assert.ok(outside.rows.filter(r => r.maturity > "2029-01-15").every(r => r.nominalMarketYtm === null && r.marketBei === null));
    assert.throws(() => buildTipsCurveAnalysis(rows, { nominalCurve: { ...nominalCurve, settleDate: "2026-12-01" } }), /does not match/);
});

test("TIPS curve analysis rejects mixed settlement dates", () => {
    assert.throws(() => buildTipsCurveAnalysis([
        { asOfDate: "2026-10-02T1405", settle_date: "2026-10-05", fwd_date: "2026-12-01" },
        { asOfDate: "2026-10-02T1405", settle_date: "2026-10-06", fwd_date: "2026-12-01" },
    ]), /one common settlement date/);
});
