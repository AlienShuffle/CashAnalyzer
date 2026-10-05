import test from "node:test";
import assert from "node:assert/strict";
import { nextWeekday, createRefCpiTable, tbillRepoRate } from "../lib/index.mjs";
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
    assert.equal(out[0].settle_date, "2026-10-05");
    assert.equal(out[0].fwd_date, "2026-11-01");
    assert.ok(out[0].fwd_clean_price_unadjusted > 90);
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
