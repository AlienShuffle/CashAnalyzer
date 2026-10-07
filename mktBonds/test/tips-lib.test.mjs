import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
    applyCredibilityFactor,
    createRefCpiTable,
    credibilityFactor,
    fullCanty,
    fullCantyPrice,
    getSaoCurve,
    normalizeDate,
    parseRefCpiCsv,
    loadRefCpiTable,
    REFCPI_URL,
    simpleCanty,
    simpleCantyPrice,
} from "../lib/index.mjs";

const CSV = `Ref CPI Date,Ref CPI NSA,Ref CPI SA,SA Factor
2026-03-02,330.10000,329.90000,1.00061
2026-03-01,330.00000,329.70000,1.00091
2025-03-15,320.00000,319.00000,1.00313
2025-03-01,319.00000,318.00000,1.00314`;

test("parseRefCpiCsv sorts newest first and filters by oldestDate", () => {
    assert.equal(parseRefCpiCsv(CSV).length, 4);
    const rows = parseRefCpiCsv(CSV, { oldestDate: "2026-01-01" });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].saFactor, 1.00061);
    assert.throws(() => parseRefCpiCsv("<html>"), /not CSV/);
});

test("refCpi table: exact, same-month/day projection and misses", () => {
    const t = createRefCpiTable(parseRefCpiCsv(CSV));
    assert.equal(t.getFactor("2026-03-01"), 1.00091);
    assert.equal(t.getFactor("2030-03-15"), 1.00313);
    assert.equal(t.getFactor("2030-07-04"), null);
    assert.equal(t.getRefCpi("2025-03-15"), 320);
    assert.equal(t.getRefCpi("2030-03-15"), null);
    assert.equal(t.maxDate.getTime(), normalizeDate("2026-03-02").getTime());
});

const PROJECT_CSV = `Date,REFCPINSA,REFCPISA,SAFactor,MMDD,maxREFCPI
2026-05-01,335,334,1.003,M0501,2026-06-01
2026-04-01,334,333,1.002,M0401,2026-05-01
2026-03-12,332,331,1.001,M0312,2026-05-01
2026-03-11,331,330,1.004,M0311,2026-04-01
2026-03-01,330,329,1.005,M0301,2026-04-01
2025-05-01,320,319,1.006,M0501,2025-06-01`;

test("project REFCPI historical horizon changes on the mapped release day", () => {
    const rows = parseRefCpiCsv(PROJECT_CSV);
    assert.equal(rows[0].maxRefCpi.getTime(), normalizeDate("2026-06-01").getTime());
    const before = createRefCpiTable(rows, { asOfDate: "2026-03-11" });
    assert.equal(before.maxDate.getTime(), normalizeDate("2026-04-01").getTime());
    assert.equal(before.getRefCpi("2026-05-01"), null);
    assert.equal(before.getFactor("2030-05-01"), 1.006);
    const on = createRefCpiTable(rows, { asOfDate: "2026-03-12" });
    assert.equal(on.maxDate.getTime(), normalizeDate("2026-05-01").getTime());
    assert.equal(on.getRefCpi("2026-05-01"), 335);
    const parsed = parseRefCpiCsv(PROJECT_CSV, { asOfDate: "2026-03-11T1405", oldestDate: "2026-04-01" });
    assert.deepEqual(parsed.map(r => r.date.getTime()), [normalizeDate("2026-04-01").getTime()]);
    assert.equal(createRefCpiTable(rows).maxDate.getTime(), on.maxDate.getTime());
    assert.throws(() => parseRefCpiCsv(PROJECT_CSV, { asOfDate: "2020-01-01" }), /no historical horizon/);
    assert.throws(() => parseRefCpiCsv(CSV, { asOfDate: "2026-03-01" }), /maxREFCPI column/);
    for (const asOfDate of ["garbage", "", "2026-02-30"]) {
        assert.throws(() => parseRefCpiCsv(PROJECT_CSV, { asOfDate }), /Invalid asOfDate/);
    }
});

test("REFCPI loader uses the project source and propagates the historical cutoff", async () => {
    assert.equal(REFCPI_URL, "https://cashoptimizer.pages.dev/Treasuries/REFCPI.csv");
    const url = `data:text/csv,${encodeURIComponent(PROJECT_CSV)}`;
    const historical = await loadRefCpiTable({ url, asOfDate: "2026-03-11" });
    assert.equal(historical.maxDate.getTime(), normalizeDate("2026-04-01").getTime());
    const full = await loadRefCpiTable({ url });
    assert.equal(full.getRefCpi("2026-05-01"), 335);
});

test("credibility shrinks factor toward 1 with horizon", () => {
    assert.equal(credibilityFactor(3, 0), 1);
    assert.ok(credibilityFactor(3, 20) < credibilityFactor(3, 1));
    const f = applyCredibilityFactor(1.003, "2026-03-01", "2046-03-15");
    assert.ok(f > 1 && f < 1.003);
    assert.equal(applyCredibilityFactor(null, "2026-03-01", "2046-03-15"), null);
});

test("canty: equal factors leave price unchanged", () => {
    assert.equal(simpleCantyPrice("2026-03-10", "2031-01-15", 0.02, 98.5, 1.001, 1.001), 98.5);
    assert.equal(fullCantyPrice("2026-03-10", "2031-01-15", 0.02, 98.5, 1.001, 1.001, 1.001), 98.5);
});

test("sao: blanks stay null, short input falls back to raw yields", () => {
    const out = getSaoCurve(["2026-03-10", "", "2026-03-10"], ["2030-01-15", "2031-01-15", "2031-07-15"], [0.02, 0.02, 0.021]);
    assert.equal(out[1], null);
    assert.equal(out[0], 0.02);
    assert.throws(() => getSaoCurve(["2026-03-10"], [], []), /different lengths/);
});

function loadAppsScript() {
    const dir = new URL("../appscript-src/", import.meta.url);
    const files = ["mybond.dates.js", "mybond.utils.js", "mybond.yieldFromPrice.js", "mybond.priceFromYield.js",
        "mybond.Canty.js", "aerokam.credibility.js", "aerokam.calcSao.js"];
    const context = vm.createContext({ Logger: { log() { } }, Math, Date });
    for (const file of files) vm.runInContext(readFileSync(new URL(file, dir), "utf8"), context, { filename: file });
    return context;
}

test("parity with Apps Script: Canty, credibility and SAO", () => {
    const gs = loadAppsScript();
    const maturities = ["2027-01-15", "2029-07-15", "2031-04-15", "2036-01-15", "2046-02-15"];
    let n = 0;
    for (const settle of ["2026-03-10", "2026-10-31"]) {
        for (const mat of maturities) {
            for (const coupon of [0, 0.00125, 0.02375]) {
                for (const price of [92, 100, 104.5]) {
                    const args = [settle, mat, coupon, price, 1.0021, 0.9987, 1.0043];
                    const sArgs = [settle, mat, coupon, price, 1.0021, 1.0043];
                    assert.equal(simpleCantyPrice(...sArgs), gs.mybondSimpleCantyPrice(...sArgs));
                    assert.equal(simpleCanty(...sArgs), gs.mybondSimpleCanty(...sArgs));
                    assert.equal(fullCantyPrice(...args), gs.mybondFullCantyPrice(...args));
                    assert.equal(fullCanty(...args), gs.mybondFullCanty(...args));
                    n++;
                }
            }
        }
    }
    assert.equal(n, 90);

    for (const m of [1, 6, 12]) for (const h of [0.5, 3, 12, 40]) {
        assert.equal(credibilityFactor(m, h), gs.credibilityFactor_(m, h));
    }
    assert.equal(
        applyCredibilityFactor(1.0031, "2026-03-10", "2041-09-15"),
        gs.applyCredibilityFactor(1.0031, "2026-03-10", "2041-09-15"),
    );

    const settles = Array(9).fill("2026-03-10");
    const matures = ["2026-04-15", "2027-01-15", "2028-04-15", "2029-07-15", "2031-04-15", "2033-01-15", "2036-01-15", "2041-02-15", "2046-02-15"];
    const ys = [0.015, 0.0175, 0.0182, 0.0191, 0.0203, 0.0211, 0.0224, 0.0231, 0.0242];
    const ours = getSaoCurve(settles, matures, ys);
    const theirs = Array.from(gs.getSaoCurve(settles, matures, ys), r => r[0]);
    assert.deepEqual(ours, Array.from(theirs));
});
