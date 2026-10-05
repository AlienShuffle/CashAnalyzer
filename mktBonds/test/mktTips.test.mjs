import test from "node:test";
import assert from "node:assert/strict";
import { nextWeekday, createRefCpiTable, tbillRepoRate } from "../lib/index.mjs";
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
    assert.equal(out[0].report_source, "Fidelity bid");
    assert.equal(buildTipsRows(meta, quotes, table, { repoRate: 0.04, priceSide: "ask" })[0].report_source, "Fidelity ask");
    assert.equal(out[0].settle_date, "2026-10-05");
    assert.equal(out[0].fwd_date, "2026-11-01");
    assert.ok(out[0].fwd_clean_price_unadjusted > 90);
    assert.ok("fwd_mature_sa_ratio_decay" in out[0]);
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

test("TIPS curve analysis rejects mixed settlement dates", () => {
    assert.throws(() => buildTipsCurveAnalysis([
        { asOfDate: "2026-10-02T1405", settle_date: "2026-10-05", fwd_date: "2026-12-01" },
        { asOfDate: "2026-10-02T1405", settle_date: "2026-10-06", fwd_date: "2026-12-01" },
    ]), /one common settlement date/);
});
