import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseResearchOptions, readResearchResults } from "./lib/research-options.mjs";
import { buildResearchPlan } from "./lib/research-calendar.mjs";
import { SHORT_BUCKETS, addMonths, inShortBucket } from "./lib/research-buckets.mjs";
import { originalSettlementPrice } from "./lib/research-pricing.mjs";
import { mean, grouped, episodeMeans, carryRelationship, forwardImprovement, referenceYield } from "./lib/research-experiment.mjs";
import { fitTipsSvensson, tipsZeroModelPrice } from "../mktBonds/lib/zero/index.mjs";
import { accruedInterest } from "../mktBonds/lib/coupons.mjs";
import { yieldFromPrice } from "../mktBonds/lib/yield.mjs";

const options = parseResearchOptions(process.argv.slice(2));
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const studyFile = path.join(options.output, "cpi-curve-analysis.json");
const study = read(studyFile);
assert.equal(study.methodology.from, options.from);
assert.equal(study.methodology.cutoff, options.through);
const execution = readResearchResults(options.results);
assert.deepEqual(execution, study.executionResults, "Rerun analyze-history before the carry experiment");
const plan = buildResearchPlan(read(path.join(options.cloud, "CPI-dates.json")), options);
assert.deepEqual(plan, study.plan, "Release plan changed; rerun analyze-history");
const daily = path.join(options.cloud, "fedBonds/daily");
const events = new Map(study.events.map(row => [row.rlsDate, row]));
const engine = ["experiment-carry.mjs", "lib/research-pricing.mjs", "lib/research-buckets.mjs",
    "lib/research-experiment.mjs",
    "../mktBonds/lib/zero/svensson.mjs", "../mktBonds/lib/zero/svenssonFit.mjs",
    "../mktBonds/lib/zero/conversions.mjs", "../mktBonds/lib/coupons.mjs",
    "../mktBonds/lib/dates.mjs", "../mktBonds/lib/yield.mjs", "../mktBonds/lib/duration.mjs",
    "../mktBonds/lib/rounding.mjs"].map(name => new URL(name, import.meta.url));
const engineHash = createHash("sha256").update(engine.map(hash).join("|")).digest("hex");
const cacheFile = path.join(options.output, "carry-reference-cache.json");
const cache = fs.existsSync(cacheFile) ? read(cacheFile) : {};
const sources = new Map([[studyFile, hash(studyFile)]]);
for (const source of read(path.join(options.output, "cpi-curve-input-hashes.json"))) {
    assert.equal(hash(source.file), source.sha256, `Study input changed; rerun analyze-history: ${source.file}`);
}
const observations = [];
const adjustments = ["none", "sa", "sa-decay"];
const cutoffs = [12, 18, 24];
const samples = study.sample.filter(row => row.eligible);
for (const [index, sample] of samples.entries()) {
    for (const side of ["ask", "bid"]) {
        const tipsFile = path.join(daily, `${sample.date}-fedTips-${side}.json`);
        const tips = read(tipsFile), byCusip = new Map(tips.map(row => [row.cusip, row]));
        const tipsHash = hash(tipsFile);
        sources.set(tipsFile, tipsHash);
        let referenceCusips;
        for (const valuation of ["settle", "forward"]) for (const adjustment of adjustments) {
            const suffix = `${valuation === "forward" ? "fwd-" : ""}${adjustment === "none" ? "" : `${adjustment}-`}`;
            const file = path.join(daily, `${sample.date}-fedTips-curve-${suffix}${side}.json`);
            const curve = read(file), curveHash = hash(file);
            sources.set(file, curveHash);
            const cusips = curve.rows.map(row => row.cusip).sort();
            if (!referenceCusips) referenceCusips = cusips;
            else assert.deepEqual(cusips, referenceCusips, "Unequal reference experiment universe");
            const settle = tips[0].settle_date.slice(0, 10), horizon = tips[0].fwd_date.slice(0, 10);
            assert.ok(curve.rows.every(row => row.maturity > horizon), "Known-inflation bond in reference universe");
            const testing = curve.rows.filter(row => row.maturity <= addMonths(settle, 12));
            for (const cutoff of cutoffs) {
                const training = curve.rows.filter(row => row.maturity > addMonths(settle, cutoff));
                assert.ok(training.length >= 6, `Insufficient training: ${sample.date} ${side} ${cutoff}`);
                assert.ok(testing.every(row => !training.some(bond => bond.cusip === row.cusip)));
                const key = `${sample.date}|${side}|${valuation}/${adjustment}|${cutoff}`;
                const signature = `${engineHash}|${tipsHash}|${curveHash}`;
                let params;
                if (cache[key]?.signature === signature) params = cache[key].params;
                else {
                    params = fitTipsSvensson(curve.settleDate, training.map(row => ({
                        maturity: row.maturity, coupon: row.coupon, cleanPrice: row.marketClean,
                    }))).params;
                    cache[key] = { signature, params };
                }
                const event = events.get(sample.event);
                assert.ok(event);
                for (const bond of testing) {
                    const row = byCusip.get(bond.cusip);
                    const clean = tipsZeroModelPrice(curve.settleDate, bond.maturity, bond.coupon, params)
                        - accruedInterest(curve.settleDate, bond.maturity, bond.coupon);
                    const predictedPrice = originalSettlementPrice(row, { valuation, adjustment }, clean);
                    const observedYield = yieldFromPrice(row.settle_date, row.maturity_date, row.interest_rate, row.settle_clean_price);
                    const predicted = referenceYield(settle, bond.maturity, row.interest_rate, predictedPrice);
                    assert.ok(Number.isFinite(observedYield));
                    observations.push({
                        date: sample.date, event: sample.event, state: sample.state, sensitive: sample.sensitive,
                        gapPp: event.gap * 100, side, variant: `${valuation}/${adjustment}`, adjustment, valuation,
                        cutoff, cusip: row.cusip, settle, horizon, maturity: bond.maturity,
                        unknownDays: (Date.parse(bond.maturity) - Date.parse(horizon)) / 86400000,
                        trainingBonds: training.length, trainingMinimum: training.map(row => row.maturity).sort()[0],
                        observedPrice: row.settle_clean_price, predictedPrice,
                        bracketedYieldSolver: predicted.bracketed,
                        yieldError: (observedYield - predicted.value) * 10000,
                        priceError: row.settle_clean_price - predictedPrice,
                    });
                }
            }
        }
    }
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
    console.log(`${index + 1}/${samples.length} longer-end reference ${sample.date}`);
}

const summary = [], relationships = [], pairs = [];
const bracketedYields = observations.filter(row => row.bracketedYieldSolver).length;
if (bracketedYields) console.warn(`Explicit bracketed yield inversion used for ${bracketedYields} extreme extrapolated prices; marked in observations.`);
const scoreFields = ["yieldError", "priceError", "yieldSquared", "priceSquared", "unknownDays"];
const scopes = {
    primary: () => true,
    ask: row => row.side === "ask",
    bid: row => row.side === "bid",
    excludeShutdownSensitive: row => !row.sensitive,
};
for (const bucket of SHORT_BUCKETS) {
    const bucketRows = observations.filter(row => inShortBucket(row, bucket));
    for (const rows of grouped(bucketRows, row => `${row.date}|${row.side}|${row.cutoff}|${row.adjustment}|${row.cusip}`)) {
        const settlement = rows.find(row => row.valuation === "settle"), forward = rows.find(row => row.valuation === "forward");
        assert.ok(settlement && forward && rows.length === 2);
        pairs.push({
            bucket: bucket.id, date: settlement.date, side: settlement.side, event: settlement.event,
            state: settlement.state, gapPp: settlement.gapPp, sensitive: settlement.sensitive,
            cutoff: settlement.cutoff, adjustment: settlement.adjustment, cusip: settlement.cusip,
            ...forwardImprovement(settlement, forward),
        });
    }
    for (const [scope, select] of Object.entries(scopes)) {
        for (const rows of grouped(bucketRows.filter(select), row => `${row.cutoff}|${row.variant}`)) {
            for (const state of ["all", "below", "near", "above"]) {
                const set = rows.filter(row => state === "all" || row.state === state);
                if (!set.length) continue;
                const episodes = episodeMeans(set.map(row => ({
                    ...row, yieldSquared: row.yieldError ** 2, priceSquared: row.priceError ** 2,
                })), scoreFields);
                summary.push({
                    scope, bucket: bucket.id, cutoff: rows[0].cutoff, variant: rows[0].variant, state,
                    events: episodes.length, dates: new Set(set.map(row => row.date)).size, bondSideObservations: set.length,
                    yieldRmse: Math.sqrt(mean(episodes.map(row => row.yieldSquared))),
                    priceRmse: Math.sqrt(mean(episodes.map(row => row.priceSquared))),
                    signedYieldError: mean(episodes.map(row => row.yieldError)),
                    signedPriceError: mean(episodes.map(row => row.priceError)),
                    meanUnknownDays: mean(episodes.map(row => row.unknownDays)),
                });
            }
        }
    }
}
for (const [scope, select] of Object.entries(scopes)) {
    for (const rows of grouped(pairs.filter(select), row => `${row.bucket}|${row.cutoff}|${row.adjustment}`)) {
        const episodes = episodeMeans(rows, ["yieldImprovement", "priceImprovement", "signedYieldChange", "signedPriceChange", "unknownDays"]);
        for (const metric of ["yieldImprovement", "priceImprovement"]) {
            relationships.push({
                scope, bucket: rows[0].bucket, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment, metric,
                meanImprovement: mean(episodes.map(row => row[metric])),
                ...carryRelationship(episodes, metric),
            });
        }
    }
}
function writeCsv(name, rows) {
    const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    fs.writeFileSync(path.join(options.output, name), `${fields.map(cell).join(",")}\n${rows.map(row => fields.map(field => cell(row[field])).join(",")).join("\n")}\n`);
}
for (const [name, rows] of Object.entries({
    observations, summary, pairs, relationships,
})) writeCsv(`carry-reference-${name}.csv`, rows);
for (const [file, expected] of sources) assert.equal(hash(file), expected, `Input changed during experiment: ${file}`);
fs.writeFileSync(path.join(options.output, "carry-reference-input-hashes.json"),
    JSON.stringify([...sources].map(([file, sha256]) => ({ file, sha256 })), null, 2));
const lines = [
    "# Longer-end reference experiment: CPI carry",
    "",
    `Range: ${options.from} through ${options.through}. Primary dates: ${samples.length}.`,
    "Training maturities are strictly beyond 12, 18, or 24 calendar months from original settlement; all tested maturities are within 12 months and strictly after historical maxREFCPI.",
    "Each variant has its own longer-end-only reference. These are alternative parameterizations, not an observable natural curve. No short test bonds enter training; all predictions extrapolate.",
    "Reference families remain Svensson: the three training cutoffs are a support sensitivity, not an independent model-family check.",
    "Errors are observed minus predicted, on original settlement basis; yield is bp and price is clean price per 100.",
    `For ${bracketedYields} extreme predictions the production Newton yield inversion was nonfinite; a bracketed inversion of the same cash flows was used and explicitly marked in observations.`,
    "Positive improvement = settlement squared error minus forward squared error. A negative carry-gap slope supports a larger forward advantage below trend.",
    "The continuous carry gap is annualized percentage points, not a CPI forecast surprise.",
    "Bonds are averaged within date/side, then date/sides within release episodes; episodes receive equal weight.",
    "Slope intervals resample whole episodes 2,000 times, fixed seed. They ignore serial dependence, repeated-security dependence across episodes, and multiple testing.",
    "The same retrospective dates generated this hypothesis; these results are exploratory, not out-of-sample validation.",
    "",
    "## Primary 6–12-month results",
    "",
    "| Training beyond months | CPI state | Variant | Episodes | Yield RMSE bp | Signed yield bp | Price RMSE / 100 |",
    "|---:|---|---|---:|---:|---:|---:|",
];
for (const row of summary.filter(row => row.scope === "primary" && row.bucket === "6-12m")) {
    lines.push(`| ${row.cutoff} | ${row.state} | ${row.variant} | ${row.events} | ${row.yieldRmse.toFixed(3)} | ${row.signedYieldError.toFixed(3)} | ${row.priceRmse.toFixed(4)} |`);
}
lines.push("", "## Continuous carry-gap relationship: 6–12 months", "",
    "Slope units are improvement in squared bp or squared price-per-100 per one percentage point of carry gap. A negative slope supports the proposed direction; its magnitude is not a return.",
    "Leave-one-episode-out ranges show whether deleting one episode changes the directional conclusion.", "",
    "| Scope | Training beyond months | Adjustment | Metric | Episodes | Slope | 95% interval | Leave-one-out range |",
    "|---|---:|---|---|---:|---:|---|---|");
const format = value => value == null ? "n/a" : value.toFixed(4);
for (const row of relationships.filter(row => row.bucket === "6-12m" && row.adjustment !== "none")) {
    lines.push(`| ${row.scope} | ${row.cutoff} | ${row.adjustment} | ${row.metric} | ${row.events} | ${format(row.slope)} | [${format(row.lower95)}, ${format(row.upper95)}] | [${format(row.leaveOneOutMin)}, ${format(row.leaveOneOutMax)}] |`);
}
lines.push("", "## Scope and next experiments", "",
    "The [summary](./carry-reference-summary.csv) includes every maturity bucket, regime, reference cutoff, and side/shutdown sensitivity.",
    "The [paired observations](./carry-reference-pairs.csv) retain unknown-inflation days for subsequent conditional/horizon plots.",
    "The [relationships](./carry-reference-relationships.csv) report descriptive univariate slopes; these do not control for maturity, season, or macro regime.",
    "A nonnegative slope, reference-sensitive sign, or interval spanning zero weakens the simple proposed mechanism.",
    "Next: an alternative curve-family reference; coherent trend-carry counterfactual; matched-bond/common-start release decomposition; prospective validation. These are not implemented by this first experiment.",
    "See [the hypothesis and experiment design](../../CPI-HYPOTHESIS.md).", "");
fs.writeFileSync(path.join(options.output, "carry-reference.md"), lines.join("\n"));
console.log(JSON.stringify({ dates: samples.length, fits: Object.keys(cache).length, observations: observations.length, pairs: pairs.length, relationships: relationships.length }));
