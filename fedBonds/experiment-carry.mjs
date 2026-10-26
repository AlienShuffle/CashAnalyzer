import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseResearchOptions, readResearchResults } from "./lib/research-options.mjs";
import { dailyReportDirectory, archivedInputPath } from "./lib/daily-archive.mjs";
import { buildResearchPlan } from "./lib/research-calendar.mjs";
import { SHORT_BUCKETS, addMonths, inShortBucket } from "./lib/research-buckets.mjs";
import { originalSettlementPrice } from "./lib/research-pricing.mjs";
import { mean, grouped, episodeMeans, carryRelationship, forwardImprovement, referenceYield, episodeInfluence } from "./lib/research-experiment.mjs";
import { fitNearestFlatReference, flatReferencePrice } from "./lib/research-flat-reference.mjs";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";
import { fitTipsSvensson, tipsZeroModelPrice } from "../mktBonds/lib/zero/index.mjs";
import { accruedInterest } from "../mktBonds/lib/coupons.mjs";
import { yieldFromPrice } from "../mktBonds/lib/yield.mjs";

const args = process.argv.slice(2);
const referenceArgs = args.filter(arg => arg.startsWith("--reference="));
assert.ok(referenceArgs.length <= 1, "Specify --reference only once");
const reference = referenceArgs[0]?.slice("--reference=".length) ?? "svensson";
assert.ok(["svensson", "flat-nearest3"].includes(reference), "reference must be svensson or flat-nearest3");
const prefix = reference === "svensson" ? "carry-reference" : "carry-flat";
const options = parseResearchOptions(args.filter(arg => !arg.startsWith("--reference=")));
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = file => createHash("sha256").update(fs.readFileSync(archivedInputPath(file))).digest("hex");
const studyFile = path.join(options.output, "cpi-curve-analysis.json");
const study = read(studyFile);
assert.equal(study.methodology.from, options.from);
assert.equal(study.methodology.cutoff, options.through);
const execution = readResearchResults(options.results);
assert.deepEqual(execution, study.executionResults, "Rerun analyze-history before the carry experiment");
const plan = buildResearchPlan(read(path.join(options.cloud, "CPI-dates.json")), options);
assert.deepEqual(plan, study.plan, "Release plan changed; rerun analyze-history");
const daily = dailyReportDirectory(options.cloud);
const events = new Map(study.events.map(row => [row.rlsDate, row]));
const engine = ["experiment-carry.mjs", "lib/research-pricing.mjs", "lib/research-buckets.mjs",
    "lib/research-experiment.mjs", "lib/research-flat-reference.mjs",
    "../mktBonds/lib/zero/svensson.mjs", "../mktBonds/lib/zero/svenssonFit.mjs",
    "../mktBonds/lib/zero/conversions.mjs", "../mktBonds/lib/coupons.mjs",
    "../mktBonds/lib/dates.mjs", "../mktBonds/lib/yield.mjs", "../mktBonds/lib/duration.mjs",
    "../mktBonds/lib/rounding.mjs"].map(name => new URL(name, import.meta.url));
const engineHash = createHash("sha256").update(engine.map(hash).join("|")).digest("hex");
const cacheFile = path.join(options.output, `${prefix}-cache.json`);
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
                const candidates = reference === "svensson" ? training : [...training]
                    .sort((a, b) => a.maturity.localeCompare(b.maturity) || a.cusip.localeCompare(b.cusip)).slice(0, 3);
                const fitBonds = candidates.map(row => ({
                    cusip: row.cusip, maturity: row.maturity, coupon: row.coupon, cleanPrice: row.marketClean,
                }));
                let fitted;
                if (cache[key]?.signature === signature) fitted = cache[key].fitted;
                else {
                    fitted = reference === "svensson" ? fitTipsSvensson(curve.settleDate, fitBonds)
                        : fitNearestFlatReference(curve.settleDate, fitBonds);
                    cache[key] = { signature, fitted };
                }
                const event = events.get(sample.event);
                assert.ok(event);
                for (const bond of testing) {
                    const row = byCusip.get(bond.cusip);
                    const clean = reference === "svensson"
                        ? tipsZeroModelPrice(curve.settleDate, bond.maturity, bond.coupon, fitted.params)
                            - accruedInterest(curve.settleDate, bond.maturity, bond.coupon)
                        : flatReferencePrice(curve.settleDate, bond.maturity, bond.coupon, fitted.rate);
                    const predictedPrice = originalSettlementPrice(row, { valuation, adjustment }, clean);
                    const observedYield = yieldFromPrice(row.settle_date, row.maturity_date, row.interest_rate, row.settle_clean_price);
                    const predicted = referenceYield(settle, bond.maturity, row.interest_rate, predictedPrice);
                    assert.ok(Number.isFinite(observedYield));
                    observations.push({
                        date: sample.date, event: sample.event, state: sample.state, sensitive: sample.sensitive,
                        gapPp: event.gap * 100, side, variant: `${valuation}/${adjustment}`, adjustment, valuation,
                        cutoff, cusip: row.cusip, settle, horizon, maturity: bond.maturity,
                        unknownDays: (Date.parse(bond.maturity) - Date.parse(horizon)) / 86400000,
                        trainingBonds: candidates.length, trainingMinimum: candidates.map(row => row.maturity).sort()[0],
                        trainingMaximum: candidates.map(row => row.maturity).sort().at(-1),
                        trainingCusips: candidates.map(row => row.cusip).join(";"),
                        flatRate: fitted.rate ?? null, trainingPriceRmse: fitted.trainingPriceRmse ?? null,
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

const summary = [], relationships = [], pairs = [], influence = [];
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
const pairFamilies = [[reference, pairs]];
if (reference === "flat-nearest3") {
    const baseline = path.join(options.output, "carry-reference-pairs.csv");
    const baselineHashes = path.join(options.output, "carry-reference-input-hashes.json");
    for (const source of read(baselineHashes)) assert.equal(hash(source.file), source.sha256, `Baseline source changed: ${source.file}`);
    sources.set(baselineHashes, hash(baselineHashes));
    sources.set(baseline, hash(baseline));
    const [headers, ...csv] = parseCsvToMatrix(fs.readFileSync(baseline, "utf8"));
    const numeric = new Set(["gapPp", "cutoff", "yieldImprovement", "priceImprovement", "unknownDays", "signedYieldChange", "signedPriceChange"]);
    const baselinePairs = csv.filter(row => row.some(value => value.trim())).map(row =>
        Object.fromEntries(headers.map((field, i) => [field, numeric.has(field) ? Number(row[i]) : field === "sensitive" ? row[i] === "true" : row[i]])));
    const identity = row => `${row.bucket}|${row.date}|${row.side}|${row.cutoff}|${row.adjustment}|${row.cusip}`;
    assert.deepEqual(baselinePairs.map(identity).sort(), pairs.map(identity).sort(), "Independent and Svensson pairs differ");
    const baselineById = new Map(baselinePairs.map(row => [identity(row), row]));
    assert.equal(baselineById.size, baselinePairs.length, "Duplicate baseline pair");
    for (const row of pairs) {
        const baselineRow = baselineById.get(identity(row));
        for (const field of ["event", "state", "gapPp", "sensitive", "unknownDays"]) {
            assert.equal(baselineRow[field], row[field], `Baseline pair metadata differs: ${identity(row)} ${field}`);
        }
    }
    pairFamilies.push(["svensson", baselinePairs]);
}
for (const [family, familyPairs] of pairFamilies) for (const [scope, select] of Object.entries(scopes)) {
    for (const rows of grouped(familyPairs.filter(select), row => `${row.bucket}|${row.cutoff}|${row.adjustment}`)) {
        const episodeRows = new Map(grouped(rows, row => row.event).map(set => [set[0].event, set]));
        const episodes = episodeMeans(rows, ["yieldImprovement", "priceImprovement", "signedYieldChange", "signedPriceChange", "unknownDays"]);
        for (const metric of ["yieldImprovement", "priceImprovement"]) {
            relationships.push({
                reference: family, scope, bucket: rows[0].bucket, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment, metric,
                meanImprovement: mean(episodes.map(row => row[metric])),
                ...carryRelationship(episodes, metric),
            });
            if (scope === "primary") influence.push(...episodeInfluence(episodes, metric).map(row => {
                const details = episodeRows.get(row.event);
                const largest = [...details].sort((a, b) => Math.abs(b[metric]) - Math.abs(a[metric]))[0];
                return {
                    reference: family, bucket: rows[0].bucket, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment, metric, ...row,
                    dates: [...new Set(details.map(item => item.date))].sort().join(";"),
                    cusips: [...new Set(details.map(item => item.cusip))].sort().join(";"),
                    bondSideObservations: details.length,
                    minimumUnknownDays: Math.min(...details.map(item => item.unknownDays)),
                    maximumUnknownDays: Math.max(...details.map(item => item.unknownDays)),
                    largestRawPairDate: largest.date, largestRawPairSide: largest.side,
                    largestRawPairCusip: largest.cusip, largestRawPairImprovement: largest[metric],
                };
            }));
        }
    }
}
function writeCsv(name, rows) {
    const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    fs.writeFileSync(path.join(options.output, name), `${fields.map(cell).join(",")}\n${rows.map(row => fields.map(field => cell(row[field])).join(",")).join("\n")}\n`);
}
for (const [name, rows] of Object.entries({
    observations, summary, pairs, relationships, influence,
})) writeCsv(`${prefix}-${name}.csv`, rows);
for (const [file, expected] of sources) assert.equal(hash(file), expected, `Input changed during experiment: ${file}`);
fs.writeFileSync(path.join(options.output, `${prefix}-input-hashes.json`),
    JSON.stringify([...sources].map(([file, sha256]) => ({ file, sha256 })), null, 2));
const lines = [
    `# Longer-end reference experiment: CPI carry (${reference})`,
    "",
    `Range: ${options.from} through ${options.through}. Primary dates: ${samples.length}.`,
    "Training maturities are strictly beyond 12, 18, or 24 calendar months from original settlement; all tested maturities are within 12 months and strictly after historical maxREFCPI.",
    "Each variant has its own longer-end-only reference. These are alternative parameterizations, not an observable natural curve. No short test bonds enter training; all predictions extrapolate.",
    reference === "svensson"
        ? "Reference families remain Svensson: the three training cutoffs are a support sensitivity, not an independent model-family check."
        : "Independent benchmark: one continuously compounded ACT/365 real rate calibrated so the sum of dirty present values equals the sum of observed dirty prices for the three nearest eligible training bonds, with equal par. This is aggregate-price matching, not least squares. No slope or monotonic yield constraint is imposed. Selection is fixed by maturity, then CUSIP; no short error is used for selection.",
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
    "| Reference | Scope | Training beyond months | Adjustment | Metric | Episodes | Slope | 95% interval | Leave-one-out range |",
    "|---|---|---:|---|---|---:|---:|---|---|");
const format = value => value == null ? "n/a" : value.toFixed(4);
for (const row of relationships.filter(row => row.bucket === "6-12m" && row.adjustment !== "none")) {
    lines.push(`| ${row.reference} | ${row.scope} | ${row.cutoff} | ${row.adjustment} | ${row.metric} | ${row.events} | ${format(row.slope)} | [${format(row.lower95)}, ${format(row.upper95)}] | [${format(row.leaveOneOutMin)}, ${format(row.leaveOneOutMax)}] |`);
}
lines.push("", "## Influential episodes: 6–12 months, full SA, price improvement", "",
    "Top three episodes by absolute change in the carry-gap slope after deleting that episode, separately for each reference and training cutoff. No episodes are excluded from primary scores.",
    "Episode labels can precede the observation range: the December 2014 CPI release governs the January 9, 2015 pre-release observation. No pre-2015 quotes are used.",
    "Mean contribution is episode improvement divided by episode count. Slope contribution sums to the full slope, but can have either sign; it is not a fraction of causal explanation.",
    "Influence is diagnostic, not a reason to discard an episode. A changed sign on deletion is marked explicitly.", "",
    "| Reference | Cutoff | Episode | Observation dates | Largest raw pair (date / side / CUSIP) | Carry gap pp | Mean contribution | Full slope | Without episode | Slope flips |",
    "|---|---:|---|---|---|---:|---:|---:|---:|---|");
for (const rows of grouped(influence.filter(row => row.bucket === "6-12m" && row.adjustment === "sa" && row.metric === "priceImprovement"),
    row => `${row.reference}|${row.cutoff}`)) {
    for (const row of [...rows].sort((a, b) => Math.abs(b.slopeChange) - Math.abs(a.slopeChange)).slice(0, 3)) {
        lines.push(`| ${row.reference} | ${row.cutoff} | ${row.event} | ${row.dates} | ${row.largestRawPairDate} / ${row.largestRawPairSide} / ${row.largestRawPairCusip} | ${format(row.gapPp)} | ${format(row.meanContribution)} | ${format(row.fullSlope)} | ${format(row.withoutSlope)} | ${row.slopeFlips} |`);
    }
}
lines.push("", "## Scope and next experiments", "",
    `The [summary](./${prefix}-summary.csv) includes every maturity bucket, regime, reference cutoff, and side/shutdown sensitivity.`,
    `The [paired observations](./${prefix}-pairs.csv) retain unknown-inflation days for subsequent conditional/horizon plots.`,
    `The [relationships](./${prefix}-relationships.csv) report descriptive univariate slopes; these do not control for maturity, season, or macro regime.`,
    `The [influence table](./${prefix}-influence.csv) identifies every episode's contribution and leave-one-out mean/slope, for both families when the independent benchmark is run.`,
    "A nonnegative slope, reference-sensitive sign, or interval spanning zero weakens the simple proposed mechanism.",
    "The flat benchmark changes both the curve family and training breadth (three nearest bonds versus the full longer-end universe). Differences cannot be attributed solely to curve family. Neither reference is an observed true short-end curve.",
    "Next: coherent trend-carry counterfactual; matched-bond/common-start release decomposition; prospective validation. These are not implemented here.",
    "See [the hypothesis and experiment design](../../CPI-HYPOTHESIS.md).", "");
fs.writeFileSync(path.join(options.output, `${prefix}.md`), lines.join("\n"));
console.log(JSON.stringify({ dates: samples.length, fits: Object.keys(cache).length, observations: observations.length, pairs: pairs.length, relationships: relationships.length }));
