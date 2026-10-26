import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { releaseCpiPath, commonStartRatio, commonStartPrice, releasePriceCube,
    releaseShapley, releaseDecomposition, commonStartRepo } from "../lib/research-release.mjs";
import { createRefCpiTable, parseRefCpiCsv } from "../../mktBonds/lib/tips/refCpi.mjs";
import { forwardTipsCleanPrice } from "../../mktBonds/lib/forwards/forwardPrice.mjs";
import { roundSeasonal } from "../../mktBonds/lib/rounding.mjs";
import { applyCredibilityFactor } from "../../mktBonds/lib/tips/credibility.mjs";
import { normalizeDate } from "../../mktBonds/lib/dates.mjs";
import { buildResearchPlan } from "../lib/research-calendar.mjs";
import { parseCsvToMatrix } from "../../lib/parseCsv.mjs";

const before = {
    cusip: "TEST", maturity_date: "2026-01-15", interest_rate: 0.02, dated_refcpi: 280,
    settle_date: "2025-01-10", settle_clean_price: 99.5, repo_rate: 0.045,
};
const after = { ...before, settle_date: "2025-01-24", settle_clean_price: 99.7, repo_rate: 0.043 };
const start = "2025-03-01";
const nsa = date => date <= normalizeDate("2025-02-01") ? 300 : 301;

test("common-start financing brackets the common target rather than reusing the old horizon rate", () => {
    const quotes = [
        { securitytype: "Bill", maturity_date: "2025-02-01", ask: 99.99, bid: 99.98 },
        { securitytype: "Bill", maturity_date: "2025-04-01", ask: 99.5, bid: 99.49 },
    ];
    const short = commonStartRepo(quotes, "ask", before.settle_date, "2025-02-01");
    const common = commonStartRepo(quotes, "ask", before.settle_date, start);
    assert.equal(common.before.price, 99.99);
    assert.equal(common.after.price, 99.5);
    assert.ok(Math.abs(common.rate - short.rate) > 0.001);
    assert.ok(commonStartRepo(quotes, "bid", before.settle_date, start).rate > common.rate);
    assert.throws(() => commonStartRepo(quotes.slice(0, 1), "ask", before.settle_date, start), /bracket/);
});

test("pre-release CPI projection never reads newly known data and anchors at its own horizon", () => {
    const known = normalizeDate("2025-02-01"), requested = [];
    const table = {
        maxDate: known,
        getRefCpi(date) {
            assert.ok(date <= known, "future CPI lookup");
            requested.push(date);
            return 300;
        },
    };
    const path = releaseCpiPath(table, start, 0.02);
    assert.equal(path(known), 300);
    assert.ok(Math.abs(path(start) - 300 * Math.exp(0.02 * 28 / 365)) < 1e-10);
    assert.equal(path("2025-01-24"), 300);
    assert.ok(requested.every(date => date <= known));
    assert.throws(() => path("2025-03-02"), /beyond/);
    assert.throws(() => releaseCpiPath(table, "2025-01-01", 0.02), /Invalid/);
    assert.throws(() => releaseCpiPath({ ...table, getRefCpi: () => null }, start, 0.02), /anchor/);
});

test("common-start full and decay ratios use only snapshot factors and the same future date", () => {
    const table = createRefCpiTable([
        { date: "2025-02-01", refCpiNSA: 300, saFactor: 1 },
        { date: "2024-03-01", refCpiNSA: 290, saFactor: 1.002 },
        { date: "2025-01-15", refCpiNSA: 299, saFactor: 0.999 },
    ]);
    assert.equal(commonStartRatio(table, start, before.maturity_date, "none"), 1);
    assert.equal(commonStartRatio(table, start, before.maturity_date, "sa"), roundSeasonal(1.002 / 0.999));
    assert.equal(commonStartRatio(table, start, before.maturity_date, "sa-decay"),
        roundSeasonal(1.002 / applyCredibilityFactor(0.999, start, before.maturity_date)));
    assert.throws(() => commonStartRatio(table, "2025-04-01", before.maturity_date, "sa"), /Missing/);
});

test("common-start price cube coherently switches quote, CPI and coupon/repo/seasonal context", () => {
    const otherNsa = date => nsa(date) * Math.exp(0.001 * (date - normalizeDate(before.settle_date)) / 86400000);
    const ratios = [1.002, 1.003], paths = [nsa, otherNsa];
    const cube = releasePriceCube(before, after, paths, start, ratios);
    for (let mask = 0; mask < 8; mask++) {
        const row = mask & 4 ? after : before, getRefCpi = paths[mask & 2 ? 1 : 0];
        const price = (mask & 1 ? after : before).settle_clean_price;
        assert.equal(cube[mask], forwardTipsCleanPrice({
            settle: row.settle_date, forward: start, maturity: row.maturity_date, coupon: row.interest_rate,
            price, datedRefCpi: row.dated_refcpi, settleRefCpi: getRefCpi(normalizeDate(row.settle_date)),
            forwardRefCpi: getRefCpi(normalizeDate(start)), repoRate: row.repo_rate, getRefCpi,
        }) * ratios[mask & 4 ? 1 : 0]);
    }
    const couponDates = [];
    commonStartPrice(before, 99.5, date => {
        couponDates.push(date.getTime());
        return nsa(date);
    }, start, 1);
    assert.ok(couponDates.includes(normalizeDate("2025-01-15").getTime()));
    couponDates.length = 0;
    commonStartPrice(after, 99.5, date => {
        couponDates.push(date.getTime());
        return nsa(date);
    }, start, 1);
    assert.ok(!couponDates.includes(normalizeDate("2025-01-15").getTime()));
    assert.throws(() => releasePriceCube(before, { ...after, interest_rate: 0.01 }, paths, start, ratios), /metadata/);
    assert.throws(() => commonStartPrice(before, -1, nsa, start, 1), /Invalid/);
});

test("Shapley splits nonlinear interactions symmetrically and reconciles residual recalibration", () => {
    const cube = Array.from({ length: 8 }, (_, mask) => {
        const q = mask & 1 ? 1 : 0, c = mask & 2 ? 1 : 0, t = mask & 4 ? 1 : 0;
        return 100 + 2 * q + 3 * c + 4 * t + 6 * q * c + 12 * q * c * t;
    });
    const result = releaseShapley(cube);
    assert.equal(result.quote, 9);
    assert.equal(result.cpi, 10);
    assert.equal(result.context, 8);
    assert.equal(result.change, 27);
    const decomposition = releaseDecomposition(cube, cube.map(value => 98 + (value - 100) / 2));
    assert.equal(decomposition.before, 2);
    assert.equal(decomposition.after, 15.5);
    assert.equal(decomposition.reference, -13.5);
    assert.equal(decomposition.netQuote + decomposition.netCpi + decomposition.netContext, decomposition.change);
    assert.ok(Math.abs(decomposition.fitQuoteImprovement + decomposition.fitCpiImprovement
        + decomposition.fitContextImprovement - decomposition.squaredImprovement) < 1e-10);
    assert.equal(decomposition.squaredImprovement, 2 ** 2 - 15.5 ** 2);
    assert.deepEqual(releaseShapley(Array(8).fill(100)), { quote: 0, cpi: 0, context: 0, change: 0 });
    const reverse = releaseShapley(cube.map((_, mask) => cube[mask ^ 7]));
    assert.ok(Math.abs(reverse.quote + result.quote) < 1e-12);
    assert.ok(Math.abs(reverse.cpi + result.cpi) < 1e-12);
    assert.ok(Math.abs(reverse.context + result.context) < 1e-12);
    assert.throws(() => releaseShapley([1, 2]), /eight/);
    assert.throws(() => releaseShapley(Array(8).fill(NaN)), /finite/);
});

test("release runner persists matched coverage and exact states, and rejects source mutation", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fed-release-test-"));
    try {
        const cloud = path.join(tmp, "cloud"), output = path.join(tmp, "output"), daily = path.join(cloud, "fedBonds/daily");
        fs.mkdirSync(daily, { recursive: true });
        fs.mkdirSync(output);
        const put = (file, data) => fs.writeFileSync(file, JSON.stringify(data));
        const releases = [{ rlsDate: "2015-04-17", cpiDate: "2015-03-01", refcpiDate: "2015-06-01" }];
        const options = { from: "2015-04-01", through: "2015-04-30" };
        const plan = buildResearchPlan(releases, options), release = plan[0];
        put(path.join(cloud, "CPI-dates.json"), releases);
        const rows = [];
        for (let day = Date.parse("2013-01-01"); day <= Date.parse("2015-06-01"); day += 86400000) {
            const date = new Date(day).toISOString().slice(0, 10);
            const nsa = 280 * Math.exp(0.02 * (day - Date.parse("2013-01-01")) / 86400000 / 365);
            rows.push(`${date},${nsa},${nsa},1,,${date < release.release ? "2015-05-01" : "2015-06-01"}`);
        }
        const cpiFile = path.join(cloud, "REFCPI.csv");
        fs.writeFileSync(cpiFile, "date,REFCPI,SA,factor,unused,maxREFCPI\n" + rows.join("\n"));
        const cpi = parseRefCpiCsv(fs.readFileSync(cpiFile, "utf8"));
        const events = [
            { rlsDate: "2015-03-24", trend6: 0.02, gap: 0.001, state: "near" },
            { rlsDate: release.release, trend6: 0.02, gap: -0.01, state: "below" },
        ];
        const sample = [release.pre, release.post].map((date, index) => ({
            date, event: events[index].rlsDate, state: events[index].state, eligible: true, sensitive: false,
        }));
        const results = sample.map(row => ({ date: row.date, status: "verified" }));
        put(path.join(output, "research-results.json"), results);
        put(path.join(output, "cpi-curve-analysis.json"), {
            methodology: { from: options.from, cutoff: options.through }, executionResults: results, plan, events, sample,
        });
        for (const [index, item] of sample.entries()) {
            const table = createRefCpiTable(cpi, { asOfDate: item.date });
            const quotes = ["2015-05-01", "2015-06-01"].map(maturity_date => ({
                asOfDate: item.date, securitytype: "Bill", maturity_date, ask: 99.9, bid: 99.89,
            }));
            put(path.join(daily, `${item.date}-rate.json`), quotes);
            for (const side of ["ask", "bid"]) {
                const maturities = ["2015-06-01", "2015-07-15", "2016-01-15", "2017-01-15", "2017-07-15", "2018-01-15", "2018-07-15"];
                const tips = maturities.map((maturity, i) => {
                    const row = {
                        ...before, cusip: `B${i}`, maturity_date: maturity, settle_date: item.date, asOfDate: item.date,
                        fwd_date: index === 0 ? "2015-05-01" : "2015-06-01", settle_refcpi: table.getRefCpi(item.date),
                        fwd_refcpi: table.getRefCpi(table.maxDate), settle_clean_price: 99.5 + i * 0.1 + index * 0.05,
                    };
                    row.repo_rate = commonStartRepo(quotes, side, row.settle_date, row.fwd_date).rate;
                    row.fwd_clean_price = forwardTipsCleanPrice({
                        settle: row.settle_date, forward: row.fwd_date, maturity, coupon: row.interest_rate,
                        price: row.settle_clean_price, datedRefCpi: row.dated_refcpi, settleRefCpi: row.settle_refcpi,
                        forwardRefCpi: row.fwd_refcpi, repoRate: row.repo_rate, getRefCpi: table.getRefCpi,
                    });
                    row.fwd_mature_sa_ratio = 1;
                    row.fwd_mature_sa_ratio_decay = 1;
                    return row;
                }).filter(row => !(side === "ask" && row.cusip === "B1") && !(index === 0 && row.cusip === "B2"));
                put(path.join(daily, `${item.date}-fedTips-${side}.json`), tips);
            }
        }
        put(path.join(output, "cpi-curve-input-hashes.json"), [{
            file: cpiFile, sha256: createHash("sha256").update(fs.readFileSync(cpiFile)).digest("hex"),
        }]);
        const args = [new URL("../decompose-release.mjs", import.meta.url).pathname,
            `--from=${options.from}`, `--through=${options.through}`, `--cloud=${cloud}`, `--output=${output}`];
        const run = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 30000 });
        assert.equal(run.status, 0, run.stderr);
        const verification = JSON.parse(fs.readFileSync(path.join(output, "release-decomposition-verification.json")));
        assert.equal(verification.completePairs, 1);
        assert.equal(verification.trainingOverlapViolations, 0);
        assert.equal(verification.knownInflationViolations, 0);
        const [headers, ...values] = parseCsvToMatrix(fs.readFileSync(path.join(output, "release-decomposition-coverage.csv"), "utf8"));
        const coverage = values.filter(row => row.length > 1).map(row => Object.fromEntries(headers.map((key, i) => [key, row[i]])));
        assert.ok(coverage.filter(row => row.side === "ask").every(row => row.testBonds === "0"));
        assert.ok(coverage.filter(row => row.side === "bid" && row.bucket === "0-6m").every(row => row.testBonds === "1"));
        assert.match(fs.readFileSync(path.join(output, "release-decomposition-unmatched.csv"), "utf8"), /missing-pre-quote/);
        assert.match(fs.readFileSync(path.join(output, "release-decomposition-unmatched.csv"), "utf8"), /maturity-on-or-before-common-start/);
        fs.appendFileSync(cpiFile, "\n");
        const rejected = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 30000 });
        assert.notEqual(rejected.status, 0);
        assert.match(rejected.stderr, /Historical input changed/);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
