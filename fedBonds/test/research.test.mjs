import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { historicalMetadata, metadataCsv } from "../../TIPSmeta/history.mjs";
import { buildResearchPlan, treasuryHolidays, shiftTrading, tradingDistance, exclusionReason } from "../lib/research-calendar.mjs";
import { parseResearchOptions, readResearchResults } from "../lib/research-options.mjs";
import { monthlyCpiReleases } from "../../lib/cpiDatesUtils.mjs";
import { originalSettlementPrice } from "../lib/research-pricing.mjs";
import { forwardTipsCleanPrice } from "../../mktBonds/lib/forwards/index.mjs";
import { SHORT_BUCKETS, inShortBucket, shortBucketMetrics } from "../lib/research-buckets.mjs";

test("short-end buckets use settlement calendar months and strictly exclude known inflation", () => {
    const row = { settle: "2025-01-31", horizon: "2025-04-01", maturity: "2025-07-31" };
    assert.deepEqual(SHORT_BUCKETS.map(bucket => inShortBucket(row, bucket)), [true, true, false]);
    assert.deepEqual(SHORT_BUCKETS.map(bucket => inShortBucket({ ...row, maturity: "2025-08-01" }, bucket)), [false, true, true]);
    assert.equal(inShortBucket({ ...row, maturity: "2025-04-30" }, SHORT_BUCKETS[1]), false);
    for (const maturity of ["2025-03-31", "2025-04-01"]) {
        assert.ok(SHORT_BUCKETS.every(bucket => !inShortBucket({ ...row, maturity }, bucket)));
    }
    assert.equal(inShortBucket({ ...row, maturity: "2026-01-31" }, SHORT_BUCKETS[2]), true);
    assert.equal(inShortBucket({ ...row, maturity: "2026-02-01" }, SHORT_BUCKETS[2]), false);
    const leap = { settle: "2023-08-31", horizon: "2023-10-01", maturity: "2024-02-29" };
    assert.equal(inShortBucket(leap, SHORT_BUCKETS[0]), true);
    assert.equal(inShortBucket({ ...leap, maturity: "2024-03-01" }, SHORT_BUCKETS[0]), false);
});

test("short-end metrics preserve missing coverage and distinguish extrapolation and nominal matches", () => {
    const row = { settle: "2025-01-01", horizon: "2025-03-01", maturity: "2025-04-01", tips: 4, bei: null, price: 0.2, extrapolated: true };
    const metrics = shortBucketMetrics([row, { ...row, tips: 2, bei: 3, price: -0.1, extrapolated: false }], SHORT_BUCKETS[0]);
    assert.equal(metrics.bonds, 2);
    assert.equal(metrics.beiBonds, 1);
    assert.equal(metrics.tipsMse, 10);
    assert.equal(metrics.beiMse, 9);
    assert.equal(metrics.extrapolatedBonds, 1);
    assert.equal(metrics.interpolatedTipsMse, 4);
    assert.equal(metrics.meanUnknownDays, 31);
    const empty = shortBucketMetrics([row], SHORT_BUCKETS[2]);
    assert.equal(empty.bonds, 0);
    assert.equal(empty.tipsMse, null);
    assert.equal(empty.priceMse, null);
    assert.equal(empty.minimumUnknownDays, null);
    assert.equal(shortBucketMetrics([row], SHORT_BUCKETS[0]).beiMse, null);
});

function auction(i, changes = {}) {
    return {
        cusip: `912828A${String(i).padStart(2, "0")}`, inflationProtected: "Yes", interestRate: "0.625",
        originalSecurityTerm: "10-Year", series: "A-2026", maturityDate: "2026-01-15T00:00:00",
        datedDate: "2016-01-15T00:00:00", originalDatedDate: "", issueDate: "2016-01-29T00:00:00",
        referenceCpiOnOriginalDatedDate: "237.61129", ...changes,
    };
}
const summary = [{
    cusip: "912828A00", interest_rate: "0.625000", maturity_date: "2026-01-15",
    dated_date: "2016-01-15", ref_cpi_on_dated_date: "237.611290", series: "A-2026",
}];

test("historical metadata keeps matured issues and original dated dates across reopenings", () => {
    const records = Array.from({ length: 6 }, (_, i) => auction(i));
    records.push(auction(1, { issueDate: "2016-05-31", datedDate: "2016-05-15" }));
    const result = historicalMetadata(records, summary);
    assert.equal(result.length, 6);
    assert.equal(result[1].dated_date, "2016-01-15");
    assert.equal(result[0].interest_rate, 0.00625);
    assert.equal(result[0].ref_cpi_on_dated_date, 237.61129);
    assert.match(metadataCsv(result), /0\.00625,10,A-2026,2026-01-15,2016-01-15,237\.61129/);
});

test("historical metadata rejects conflicting official records and missing data", () => {
    const records = Array.from({ length: 6 }, (_, i) => auction(i));
    assert.throws(() => historicalMetadata([...records, auction(0, { interestRate: "0.750" })], summary), /Conflicting/);
    assert.throws(() => historicalMetadata(records, [{ ...summary[0], ref_cpi_on_dated_date: "238" }]), /mismatch/);
    assert.throws(() => historicalMetadata(records.map(row => ({ ...row, referenceCpiOnOriginalDatedDate: "" })), summary), /Missing/);
    assert.throws(() => historicalMetadata(records.map(row => ({ ...row, interestRate: "Infinity" })), summary), /Missing/);
    assert.throws(() => historicalMetadata(records, [{ ...summary[0], cusip: "912828ZZZ" }]), /missing from auction/);
});

test("research Treasury calendar handles early closes, full closures, Juneteenth and exceptional closures", () => {
    const holidays = treasuryHolidays(2015, 2026);
    for (const date of ["2015-04-03", "2021-04-02", "2026-04-03", "2025-01-09", "2021-06-18"]) {
        assert.equal(holidays.has(date), false, date);
    }
    for (const date of ["2018-03-30", "2018-12-05", "2022-06-20", "2025-06-19", "2026-07-03", "2026-05-25"]) {
        assert.equal(holidays.has(date), true, date);
    }
    for (const date of ["2016-11-24", "2017-11-23", "2018-11-22", "2026-11-26"]) {
        assert.equal(holidays.has(date), true, date);
    }
    assert.equal(holidays.has("2016-12-01"), false);
    assert.equal(shiftTrading("2026-04-10", -5, holidays), "2026-04-03");
    assert.equal(shiftTrading("2026-07-14", -5, holidays), "2026-07-07");
    assert.equal(shiftTrading("2025-06-11", 5, holidays), "2025-06-18");
    assert.equal(shiftTrading("2017-04-14", -5, holidays), "2017-04-07");
    assert.equal(tradingDistance("2017-04-14", "2017-04-07", holidays), -5);
    assert.equal(tradingDistance("2017-04-14", "2017-04-21", holidays), 5);
});

test("research plan uses actual releases and agreed exclusions without excluding later flagged trends", () => {
    const releases = ["2020-03-11", "2022-12-13", "2023-01-12", "2025-10-24", "2025-12-18", "2026-01-13", "2026-10-14"]
        .map(rlsDate => ({ rlsDate }));
    const plan = buildResearchPlan(releases, { through: "2026-10-25" });
    assert.deepEqual(plan.filter(row => row.included).map(row => row.release), ["2023-01-12", "2026-01-13", "2026-10-14"]);
    assert.equal(plan.find(row => row.release === "2026-10-14").pre, "2026-10-06");
    assert.equal(plan.find(row => row.release === "2026-10-14").post, "2026-10-21");
    assert.equal(plan.find(row => row.release === "2026-01-13").filledCpiTrendRisk, true);
    assert.equal(exclusionReason("2023-01-01"), null);
    assert.throws(() => buildResearchPlan([], { from: "2014-01-01" }), /2015/);
});

test("research options fail explicitly and analysis rejects failed batches", () => {
    assert.throws(() => parseResearchOptions(["--unknown=1"]), /Unknown/);
    assert.throws(() => parseResearchOptions(["--from=2026-02-30"]), /Invalid date/);
    assert.equal(parseResearchOptions(["--through=2026-10-25"]).from, "2015-01-01");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "research-options-"));
    try {
        const file = path.join(temp, "results.json");
        fs.writeFileSync(file, JSON.stringify([{ date: "2026-01-06", status: "failed" }]));
        assert.throws(() => readResearchResults(file), /failed dates/);
        fs.writeFileSync(file, JSON.stringify([{ date: "2026-01-06", status: "verified" }]));
        assert.equal(readResearchResults(file).length, 1);
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});

test("monthly CPI announcements exclude earlier annual seasonal-revision dates", () => {
    const rows = [
        { rlsDate: "2015-02-20", cpiDate: "2015-01-01" },
        { rlsDate: "2015-02-26", cpiDate: "2015-01-01" },
        { rlsDate: "2024-02-09", cpiDate: "2024-01-01" },
        { rlsDate: "2024-02-13", cpiDate: "2024-01-01" },
        { rlsDate: "2025-10-24", cpiDate: "2025-09-01" },
    ];
    assert.deepEqual(monthlyCpiReleases(rows).map(row => row.rlsDate),
        ["2015-02-26", "2024-02-13", "2025-10-24"]);
});

test("all six curve predictions invert to original prices, including indexed coupon carry", () => {
    const args = {
        settle: "2025-06-02", forward: "2025-08-01", maturity: "2026-07-15", coupon: 0.0125,
        price: 99, datedRefCpi: 270, settleRefCpi: 319, forwardRefCpi: 322, repoRate: 0.04,
        getRefCpi: () => 321,
    };
    const row = {
        settle_date: args.settle, fwd_date: args.forward, settle_clean_price: args.price,
        fwd_clean_price: forwardTipsCleanPrice(args), settle_refcpi: args.settleRefCpi,
        fwd_refcpi: args.forwardRefCpi, repo_rate: args.repoRate,
        settle_mature_sa_ratio: 0.998, settle_mature_sa_ratio_decay: 0.999,
        fwd_mature_sa_ratio: 1.001, fwd_mature_sa_ratio_decay: 1.0005,
    };
    for (const valuation of ["settle", "forward"]) {
        for (const adjustment of ["none", "sa", "sa-decay"]) {
            const variant = { valuation, adjustment };
            const prefix = valuation === "forward" ? "fwd" : "settle";
            const ratio = adjustment === "none" ? 1 : row[`${prefix}_mature_sa_ratio${adjustment === "sa-decay" ? "_decay" : ""}`];
            const base = row[`${prefix}_clean_price`];
            assert.equal(originalSettlementPrice(row, variant, base * ratio), args.price);
            const bumped = valuation === "forward" ? forwardTipsCleanPrice({ ...args, price: args.price + 0.25 }) : args.price + 0.25;
            assert.ok(Math.abs(originalSettlementPrice(row, variant, bumped * ratio) - 99.25) < 0.000002);
        }
    }
    assert.throws(() => originalSettlementPrice(row, { valuation: "bad", adjustment: "none" }, 99), /Invalid/);
});
