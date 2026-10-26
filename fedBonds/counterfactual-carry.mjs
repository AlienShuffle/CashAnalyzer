import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseResearchOptions, readResearchResults } from "./lib/research-options.mjs";
import { dailyReportDirectory, archivedInputPath } from "./lib/daily-archive.mjs";
import { buildResearchPlan } from "./lib/research-calendar.mjs";
import { SHORT_BUCKETS, addMonths, inShortBucket } from "./lib/research-buckets.mjs";
import { originalSettlementPrice } from "./lib/research-pricing.mjs";
import { mean, grouped, episodeMeans, referenceYield, carryRelationship, forwardImprovement } from "./lib/research-experiment.mjs";
import { trendCarryPath, repriceCarryRow, transformedPrice, fixedReferencePrediction, displacement,
    pairedMeanInterval } from "./lib/research-counterfactual.mjs";
import { fitNearestFlatReference, flatReferencePrice } from "./lib/research-flat-reference.mjs";
import { parseRefCpiCsv } from "../mktBonds/lib/tips/refCpi.mjs";
import { daysBetween, normalizeDate } from "../mktBonds/lib/dates.mjs";
import { roundPrice } from "../mktBonds/lib/rounding.mjs";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";

const options = parseResearchOptions(process.argv.slice(2));
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const hash = file => createHash("sha256").update(fs.readFileSync(archivedInputPath(file))).digest("hex");
const sources = new Map();
function input(file) {
    sources.set(file, hash(file));
    return fs.readFileSync(file, "utf8");
}
function csv(file) {
    const [headers, ...rows] = parseCsvToMatrix(input(file));
    return rows.filter(row => row.some(value => value.trim())).map(row => Object.fromEntries(headers.map((key, i) => {
        const value = row[i];
        return [key, value === "true" ? true : value === "false" ? false
            : value !== "" && Number.isFinite(Number(value)) ? Number(value) : value];
    })));
}
const study = JSON.parse(input(path.join(options.output, "cpi-curve-analysis.json")));
assert.equal(study.methodology.from, options.from);
assert.equal(study.methodology.cutoff, options.through);
input(options.results);
assert.deepEqual(readResearchResults(options.results), study.executionResults, "Rerun historical analysis: execution ledger changed");
assert.deepEqual(buildResearchPlan(JSON.parse(input(path.join(options.cloud, "CPI-dates.json"))), options), study.plan);
for (const prefix of ["cpi-curve", "carry-reference", "carry-flat"]) {
    for (const source of JSON.parse(input(path.join(options.output, `${prefix}-input-hashes.json`)))) {
        assert.equal(hash(source.file), source.sha256, `Historical input changed: ${source.file}`);
        sources.set(source.file, source.sha256);
    }
}
for (const name of ["counterfactual-carry.mjs", "lib/research-counterfactual.mjs", "lib/research-flat-reference.mjs",
    "lib/research-experiment.mjs", "lib/research-pricing.mjs", "lib/research-buckets.mjs",
    "lib/research-options.mjs", "lib/research-calendar.mjs", "../lib/parseCsv.mjs",
    "../mktBonds/lib/tips/refCpi.mjs", "../mktBonds/lib/forwards/forwardPrice.mjs",
    "../mktBonds/lib/coupons.mjs", "../mktBonds/lib/dates.mjs", "../mktBonds/lib/yield.mjs",
    "../mktBonds/lib/rounding.mjs"]) input(new URL(name, import.meta.url));
const iso = value => {
    const date = normalizeDate(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const cpi = new Map(parseRefCpiCsv(input(path.join(options.cloud, "REFCPI.csv")))
    .map(row => [iso(row.date), row.refCpiNSA]));
const events = new Map(study.events.map(event => [event.rlsDate, event]));
const samples = new Map(study.sample.filter(row => row.eligible).map(row => [row.date, row]));
const baselines = [
    ["svensson-fixed", csv(path.join(options.output, "carry-reference-observations.csv"))],
    ["flat-fixed", csv(path.join(options.output, "carry-flat-observations.csv"))],
];
const identity = row => `${row.date}|${row.side}|${row.variant}|${row.cutoff}|${row.cusip}`;
assert.deepEqual(baselines[0][1].map(identity).sort(), baselines[1][1].map(identity).sort(), "Reference samples differ");
const rowsByDateSide = new Map(), fitCache = new Map(), paths = new Map();
const observations = [];
let identityChecks = 0, couponLookups = 0, bracketedYields = 0, maxIdentityError = 0, maxRateIdentityError = 0;
function dateRows(date, side) {
    const key = `${date}|${side}`;
    if (rowsByDateSide.has(key)) return rowsByDateSide.get(key);
    const tips = JSON.parse(input(path.join(dailyReportDirectory(options.cloud), `${date}-fedTips-${side}.json`)));
    const sample = samples.get(date), event = events.get(sample?.event);
    assert.ok(event && Number.isFinite(event.trend6), "Missing historical trend");
    const eligible = tips.filter(row => row.maturity_date.slice(0, 10) > row.fwd_date.slice(0, 10));
    assert.ok(eligible.length >= 6);
    const pairs = eligible.map(actual => {
        const getActual = day => {
            assert.ok(iso(day) <= actual.fwd_date.slice(0, 10), "Future CPI leakage");
            const value = cpi.get(iso(day));
            assert.ok(Number.isFinite(value) && value > 0, "Missing historical CPI");
            return value;
        };
        assert.equal(getActual(normalizeDate(actual.settle_date)), actual.settle_refcpi);
        assert.equal(getActual(normalizeDate(actual.fwd_date)), actual.fwd_refcpi);
        const reconstructed = repriceCarryRow(actual, getActual);
        const error = Math.abs(reconstructed.fwd_clean_price - actual.fwd_clean_price);
        maxIdentityError = Math.max(maxIdentityError, error);
        assert.ok(error < 1e-8, `Archived forward reconstruction differs: ${date} ${side} ${actual.cusip}`);
        const carry = trendCarryPath(actual, event.trend6, getActual);
        const cf = repriceCarryRow(actual, day => {
            if (iso(day) !== actual.settle_date.slice(0, 10) && iso(day) !== actual.fwd_date.slice(0, 10)) couponLookups++;
            return carry.getRefCpi(day);
        });
        assert.equal(cf.settle_clean_price, actual.settle_clean_price);
        assert.equal(cf.fwd_date, actual.fwd_date);
        const cfCarry = Math.log(cf.fwd_refcpi / cf.settle_refcpi)
            / (daysBetween(normalizeDate(cf.settle_date), normalizeDate(cf.fwd_date)) / 365);
        assert.ok(Math.abs(cfCarry - event.trend6) < 1e-11, "Counterfactual endpoint misses trend");
        paths.set(key, {
            date, side, event: sample.event, state: sample.state, sensitive: sample.sensitive,
            settle: actual.settle_date.slice(0, 10), horizon: actual.fwd_date.slice(0, 10),
            trend: event.trend6, actualCarry: carry.actualCarry, settlementGapPp: -carry.tilt * 100,
            announcementGapPp: event.gap * 100, actualHorizonCpi: actual.fwd_refcpi, trendHorizonCpi: cf.fwd_refcpi,
        });
        identityChecks++;
        return [actual.cusip, { actual, cf, gap: -carry.tilt * 100 }];
    });
    const result = new Map(pairs);
    rowsByDateSide.set(key, result);
    return result;
}
for (const [method, baseline] of baselines) {
    assert.equal(new Set(baseline.map(identity)).size, baseline.length, "Duplicate reference observations");
    for (const base of baseline) {
        const sample = samples.get(base.date);
        assert.ok(sample && base.event === sample.event && base.state === sample.state && base.sensitive === sample.sensitive);
        const pairs = dateRows(base.date, base.side), pair = pairs.get(base.cusip);
        assert.ok(pair, "Reference bond excluded from counterfactual");
        const { actual, cf } = pair;
        assert.equal(base.observedPrice, actual.settle_clean_price);
        assert.equal(base.maturity, actual.maturity_date.slice(0, 10));
        assert.equal(base.settle, actual.settle_date.slice(0, 10));
        assert.equal(base.horizon, actual.fwd_date.slice(0, 10));
        assert.ok(Math.abs(base.priceError - (base.observedPrice - base.predictedPrice)) < 1e-10);
        assert.ok(base.maturity > base.horizon && base.maturity <= addMonths(base.settle, 12));
        const variant = { valuation: base.valuation, adjustment: base.adjustment };
        const fixed = fixedReferencePrediction(actual, cf, variant, base.predictedPrice);
        const predictions = [[method, fixed]];
        if (method === "flat-fixed") {
            const key = `${base.date}|${base.side}|${base.variant}|${base.cutoff}`;
            if (!fitCache.has(key)) {
                const selected = [...pairs.values()].filter(pair => pair.actual.maturity_date.slice(0, 10) > addMonths(base.settle, base.cutoff))
                    .sort((a, b) => a.actual.maturity_date.localeCompare(b.actual.maturity_date) || a.actual.cusip.localeCompare(b.actual.cusip))
                    .slice(0, 3);
                assert.equal(selected.length, 3);
                assert.equal(selected.map(pair => pair.actual.cusip).join(";"), base.trainingCusips, "Training selection changed");
                assert.ok(!selected.some(pair => pair.actual.cusip === base.cusip), "Short training leakage");
                const bonds = selected.map(pair => ({
                    cusip: pair.cf.cusip, maturity: pair.cf.maturity_date, coupon: pair.cf.interest_rate,
                    cleanPrice: roundPrice(transformedPrice(pair.cf, variant).clean),
                }));
                const start = base.valuation === "settle" ? actual.settle_date : actual.fwd_date;
                const actualFit = fitNearestFlatReference(start, selected.map(pair => ({
                    cusip: pair.actual.cusip, maturity: pair.actual.maturity_date, coupon: pair.actual.interest_rate,
                    cleanPrice: roundPrice(transformedPrice(pair.actual, variant).clean),
                })));
                const rateError = Math.abs(actualFit.rate - base.flatRate);
                maxRateIdentityError = Math.max(maxRateIdentityError, rateError);
                assert.ok(rateError < 1e-12, "Actual-path recalibration differs from archived reference");
                const fit = fitNearestFlatReference(start, bonds);
                fitCache.set(key, { ...fit, start });
            }
            const fit = fitCache.get(key);
            const clean = flatReferencePrice(fit.start, cf.maturity_date, cf.interest_rate, fit.rate);
            predictions.push(["flat-refit", originalSettlementPrice(cf, variant, clean)]);
        }
        const observedYield = referenceYield(actual.settle_date, actual.maturity_date, actual.interest_rate, actual.settle_clean_price).value;
        for (const [name, predictedPrice] of predictions) {
            const predictedYield = referenceYield(actual.settle_date, actual.maturity_date, actual.interest_rate, predictedPrice);
            if (predictedYield.bracketed) bracketedYields++;
            const priceError = actual.settle_clean_price - predictedPrice;
            const yieldError = (observedYield - predictedYield.value) * 10000;
            const price = displacement(base.priceError, priceError), yieldChange = displacement(base.yieldError, yieldError);
            if (base.valuation === "settle") assert.ok(Math.abs(predictedPrice - base.predictedPrice) < 1e-8,
                `Settlement curve changed: ${name} ${identity(base)} ${predictedPrice - base.predictedPrice}`);
            observations.push({
                ...base, method: name, settlementGapPp: pair.gap,
                actualPredictedPrice: base.predictedPrice, actualPriceError: base.priceError, actualYieldError: base.yieldError,
                predictedPrice, priceError, yieldError, bracketedYieldSolver: predictedYield.bracketed,
                actualPriceSquared: base.priceError ** 2, priceSquared: priceError ** 2,
                actualYieldSquared: base.yieldError ** 2, yieldSquared: yieldError ** 2,
                signedPriceChange: priceError - base.priceError, signedYieldChange: yieldError - base.yieldError,
                priceImprovement: price.improvement, yieldImprovement: yieldChange.improvement,
                toward: price.toward, through: price.through,
                counterfactualFlatRate: name === "flat-refit" ? fitCache.get(`${base.date}|${base.side}|${base.variant}|${base.cutoff}`).rate : null,
            });
        }
    }
}
const summary = [], pairs = [], relationships = [];
const scopes = {
    primary: () => true, ask: row => row.side === "ask", bid: row => row.side === "bid",
    excludeShutdownSensitive: row => !row.sensitive,
};
const scoreFields = ["actualPriceSquared", "priceSquared", "actualYieldSquared", "yieldSquared",
    "actualPriceError", "priceError", "actualYieldError", "yieldError", "signedPriceChange", "signedYieldChange",
    "priceImprovement", "yieldImprovement", "toward", "through", "unknownDays"];
for (const bucket of SHORT_BUCKETS) {
    const bucketRows = observations.filter(row => inShortBucket(row, bucket));
    for (const rows of grouped(bucketRows, row => `${row.method}|${row.date}|${row.side}|${row.cutoff}|${row.adjustment}|${row.cusip}`)) {
        const settlement = rows.find(row => row.valuation === "settle"), forward = rows.find(row => row.valuation === "forward");
        assert.ok(rows.length === 2 && settlement && forward);
        const actual = forwardImprovement({ ...settlement, priceError: settlement.actualPriceError, yieldError: settlement.actualYieldError },
            { ...forward, priceError: forward.actualPriceError, yieldError: forward.actualYieldError });
        pairs.push({
            bucket: bucket.id, method: forward.method, date: forward.date, side: forward.side, event: forward.event,
            state: forward.state, gapPp: forward.gapPp, sensitive: forward.sensitive,
            cutoff: forward.cutoff, adjustment: forward.adjustment, cusip: forward.cusip,
            actualPriceImprovement: actual.priceImprovement, actualYieldImprovement: actual.yieldImprovement,
            ...forwardImprovement(settlement, forward),
        });
    }
    for (const [scope, select] of Object.entries(scopes)) {
        for (const rows of grouped(bucketRows.filter(select), row => `${row.method}|${row.cutoff}|${row.variant}`)) {
            for (const state of ["all", "below", "near", "above"]) {
                const set = rows.filter(row => state === "all" || row.state === state);
                if (!set.length) continue;
                const episodes = episodeMeans(set, scoreFields);
                const interval = pairedMeanInterval(episodes, "priceImprovement");
                summary.push({
                    method: rows[0].method, scope, bucket: bucket.id, cutoff: rows[0].cutoff, variant: rows[0].variant, state,
                    events: episodes.length, dates: new Set(set.map(row => row.date)).size, bondSideObservations: set.length,
                    actualPriceRmse: Math.sqrt(mean(episodes.map(row => row.actualPriceSquared))),
                    priceRmse: Math.sqrt(mean(episodes.map(row => row.priceSquared))),
                    actualYieldRmse: Math.sqrt(mean(episodes.map(row => row.actualYieldSquared))),
                    yieldRmse: Math.sqrt(mean(episodes.map(row => row.yieldSquared))),
                    signedActualPriceError: mean(episodes.map(row => row.actualPriceError)),
                    signedPriceError: mean(episodes.map(row => row.priceError)),
                    signedActualYieldError: mean(episodes.map(row => row.actualYieldError)),
                    signedYieldError: mean(episodes.map(row => row.yieldError)),
                    signedPriceChange: mean(episodes.map(row => row.signedPriceChange)),
                    signedYieldChange: mean(episodes.map(row => row.signedYieldChange)),
                    priceImprovement: interval.mean, lower95: interval.lower95, upper95: interval.upper95,
                    yieldImprovement: mean(episodes.map(row => row.yieldImprovement)),
                    towardFraction: mean(episodes.map(row => row.toward)),
                    throughFraction: mean(episodes.map(row => row.through)),
                    meanUnknownDays: mean(episodes.map(row => row.unknownDays)),
                });
            }
        }
    }
}
for (const [scope, select] of Object.entries(scopes)) {
    for (const rows of grouped(pairs.filter(select), row => `${row.method}|${row.bucket}|${row.cutoff}|${row.adjustment}`)) {
        const episodes = episodeMeans(rows, ["priceImprovement", "actualPriceImprovement", "yieldImprovement", "actualYieldImprovement"]);
        for (const metric of ["priceImprovement", "yieldImprovement"]) for (const scenario of ["actual", "trend"]) {
            relationships.push({
                method: rows[0].method, scope, bucket: rows[0].bucket, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment,
                metric, scenario, ...carryRelationship(episodes, scenario === "actual" ? `actual${metric[0].toUpperCase()}${metric.slice(1)}` : metric),
            });
        }
    }
}
const verification = {
    dates: samples.size, dateSides: rowsByDateSide.size, reconstructedEligibleRows: identityChecks,
    maxArchivedForwardPriceDifference: maxIdentityError, interveningCouponLookups: couponLookups,
    flatRefits: fitCache.size, actualPathCalibrationChecks: fitCache.size,
    maxArchivedFlatRateDifference: maxRateIdentityError, baselineObservationsPerFamily: baselines[0][1].length,
    observations: observations.length, pairs: pairs.length, summaries: summary.length, relationships: relationships.length,
    bracketedYields, knownInflationViolations: observations.filter(row => row.maturity <= row.horizon).length,
    duplicateObservationKeys: observations.length - new Set(observations.map(row => `${row.method}|${identity(row)}`)).size,
};
assert.equal(observations.length, baselines[0][1].length * 3);
assert.equal(verification.duplicateObservationKeys, 0);
assert.equal(verification.knownInflationViolations, 0);
const report = [
    "# Trend-carry counterfactual", "",
    `Range: ${options.from} through ${options.through}; ${samples.size} eligible dates.`, "",
    "Observed settlement quotes, repo rates, dates, bond universes, and seasonal factors are unchanged.",
    "CPI is anchored at observation settlement. Daily NSA CPI is multiplied by exp((trend minus actual settlement-to-horizon log carry) times ACT/365 years since settlement).",
    "The prior six-month SA trend is taken from the latest already-known release. The endpoint NSA carry equals this trend; interior daily variation is retained with a smooth log tilt.",
    "Apply the identical proportional tilt to SA CPI: NSA/SA seasonal factors and all full/decay seasonal ratios remain unchanged. This is not a seasonally neutral NSA path.",
    "Intervening indexed coupons and forward clean prices are recomputed by the production pricer, including repo carry of coupons.",
    "Refit training clean prices use the archived curve publisher's six-decimal rounding; actual-path recalibrations must reproduce the archived rates.",
    "svensson-fixed and flat-fixed hold each saved transformed longer-end reference fixed; flat-refit recalibrates the same three training bonds under the trend path. No new Svensson fit is performed.",
    "All predictions/errors are on original observed settlement price/yield basis. Positive counterfactual improvement means actual error squared minus trend-path error squared.",
    "Toward means smaller absolute price residual; through means the signed price residual changes sign. These can occur together.",
    "Carry-gap relationship tables instead retain settlement-error-squared minus forward-error-squared; actual and trend scenarios use identical original announcement-based gap labels.",
    "Episode-balanced means and paired 2,000-resample episode-bootstrap price-improvement intervals use fixed seed 1729. Serial dependence, repeated securities, and multiplicity remain unmodeled.",
    "This is a mechanical sensitivity, not counterfactual market prices, a causal CPI effect, realized returns, or prospective validation.",
    "The 0–6-month sample is bid-only; overlapping buckets and many exploratory comparisons are not independent evidence.", "",
    "## Primary 6–12-month forward comparisons", "",
    "Price RMSE is clean price per 100; yield RMSE is bp. The interval is for paired squared-price-error improvement, not RMSE.", "",
    "| Method | Cutoff months | Adjustment | State | Episodes | Actual price RMSE | Trend price RMSE | Actual yield RMSE | Trend yield RMSE | Squared-price improvement [95%] | Toward | Through |",
    "|---|---:|---|---|---:|---:|---:|---:|---:|---|---:|---:|",
];
const fmt = value => value.toFixed(5);
for (const row of summary.filter(row => row.scope === "primary" && row.bucket === "6-12m" && row.variant.startsWith("forward/"))) {
    report.push(`| ${row.method} | ${row.cutoff} | ${row.variant.split("/")[1]} | ${row.state} | ${row.events} | ${fmt(row.actualPriceRmse)} | ${fmt(row.priceRmse)} | ${fmt(row.actualYieldRmse)} | ${fmt(row.yieldRmse)} | ${fmt(row.priceImprovement)} [${fmt(row.lower95)}, ${fmt(row.upper95)}] | ${(row.towardFraction * 100).toFixed(1)}% | ${(row.throughFraction * 100).toFixed(1)}% |`);
}
report.push("", "## Verification", "", "```json", JSON.stringify(verification, null, 2), "```", "");
// Verify inputs before publishing any results, including engine files and both reference manifests.
for (const [file, expected] of sources) assert.equal(hash(file), expected, `Input changed during counterfactual: ${file}`);
for (const [name, rows] of Object.entries({ observations, summary, pairs, relationships, paths: [...paths.values()] })) {
    const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    fs.writeFileSync(path.join(options.output, `carry-counterfactual-${name}.csv`),
        `${fields.map(cell).join(",")}\n${rows.map(row => fields.map(field => cell(row[field])).join(",")).join("\n")}\n`);
}
fs.writeFileSync(path.join(options.output, "carry-counterfactual-input-hashes.json"),
    JSON.stringify([...sources].map(([file, sha256]) => ({ file: file instanceof URL ? file.pathname : file, sha256 })), null, 2));
fs.writeFileSync(path.join(options.output, "carry-counterfactual-verification.json"), JSON.stringify(verification, null, 2));
fs.writeFileSync(path.join(options.output, "carry-counterfactual.md"), report.join("\n"));
console.log(JSON.stringify(verification, null, 2));
