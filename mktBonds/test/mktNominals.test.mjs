import test from "node:test";
import assert from "node:assert/strict";
import { buildNominalRows } from "../node-mktNominals-update.mjs";
import { forwardNominalCleanPrice, tbillRepoRate } from "../lib/forwards/index.mjs";
import { roundYield } from "../lib/rounding.mjs";
import { yieldFromPrice } from "../lib/yield.mjs";

const quotes = [
    { cusip: "BOND", securitytype: "Bond", rate: 0.04, maturitydate: "2030-07-15", bid: 98, ask: 99 },
    { cusip: "BEFORE", securitytype: "Bill", rate: "", maturitydate: "2026-10-29", bid: 99.7, ask: 99.75 },
    { cusip: "AFTER", securitytype: "Bill", rate: "", maturitydate: "2026-11-03", bid: 99.65, ask: 99.7 },
    { cusip: "TIPS", securitytype: "TIPS", rate: 0.01, maturitydate: "2030-07-15", bid: 98, ask: 99 },
    { cusip: "MATURED", securitytype: "Bond", rate: 0.04, maturitydate: "2026-10-04", bid: 100, ask: 100 },
    { cusip: "MISSING", securitytype: "Bond", rate: 0.04, maturitydate: "2030-07-15", bid: "", ask: "" },
].map(q => ({ ...q, asOfDate: "2026-10-02T1405" }));

test("nominal ask and bid tables select matching prices, repo rates and yields without SA", () => {
    for (const priceSide of ["ask", "bid"]) {
        const rows = buildNominalRows(quotes, "2026-11-01", { priceSide });
        assert.deepEqual(rows.map(r => r.cusip), ["BOND", "BEFORE", "AFTER"]);
        const [row] = rows;
        assert.equal(row.report_source, `Market ${priceSide}`);
        assert.equal(row.settle_date, "2026-10-05");
        assert.equal(row.fwd_date, "2026-11-01");
        assert.equal(row.settle_clean_price, quotes[0][priceSide]);
        const repo = roundYield(tbillRepoRate(row.settle_date, row.fwd_date, quotes
            .filter(q => q.securitytype === "Bill")
            .map(q => ({ maturity: q.maturitydate, price: q[priceSide] }))).rate);
        assert.equal(row.repo_rate, repo);
        assert.equal(row.fwd_clean_price_unadjusted, forwardNominalCleanPrice({
            settle: row.settle_date, forward: row.fwd_date, maturity: row.maturitydate,
            coupon: row.rate, price: row.settle_clean_price, repoRate: repo,
        }));
        assert.equal(row.settle_ytm, yieldFromPrice(row.settle_date, row.maturitydate, row.rate, row.settle_clean_price));
        assert.equal(row.forward_ytm, yieldFromPrice(row.fwd_date, row.maturitydate, row.rate, row.fwd_clean_price_unadjusted));
        assert.equal(rows[1].fwd_clean_price_unadjusted, null);
        assert.equal(rows[1].forward_ytm, null);
        assert.ok(rows.every(r => !Object.keys(r).some(k => k.includes("_sa_"))));
    }
    const ask = buildNominalRows(quotes, "2026-11-01");
    const bid = buildNominalRows(quotes, "2026-11-01", { priceSide: "bid" });
    assert.ok(bid[0].settle_ytm > ask[0].settle_ytm);
});

test("nominal tables validate side, dates and financing inputs", () => {
    assert.throws(() => buildNominalRows(quotes, "2026-11-01", { priceSide: "mid" }), /priceSide/);
    assert.throws(() => buildNominalRows(quotes, "2026-11-01", { repoRate: NaN }), /repoRate/);
    assert.throws(() => buildNominalRows([], "2026-11-01"), /asOfDate/);
    assert.throws(() => buildNominalRows(quotes, "2026-10-01"), /Forward date/);
    assert.throws(() => buildNominalRows(quotes, "2027-01-01"), /bracket/);
    const [row] = buildNominalRows(quotes, "2026-11-01", { repoRate: 0.04 });
    assert.equal(row.repo_rate, 0.04);
});
