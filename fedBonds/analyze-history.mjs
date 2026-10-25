import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fitTipsSvensson, svenssonZero, tipsZeroModelPrice } from "../mktBonds/lib/zero/index.mjs";
import { accruedInterest } from "../mktBonds/lib/coupons.mjs";
import { daysBetween, normalizeDate } from "../mktBonds/lib/dates.mjs";
import { yieldFromPrice } from "../mktBonds/lib/yield.mjs";
import { curveFitStats } from "../mktBonds/node-calc-mktTips-fitHistory.mjs";
import { parseResearchOptions, readResearchResults } from "./lib/research-options.mjs";
import { treasuryHolidays, tradingDistance as distance, shiftTrading as shiftBusiness, buildResearchPlan, exclusionReason } from "./lib/research-calendar.mjs";
import { originalSettlementPrice } from "./lib/research-pricing.mjs";
import { SHORT_BUCKETS, shortBucketMetrics } from "./lib/research-buckets.mjs";

const options = parseResearchOptions(process.argv.slice(2));
const output = options.output;
fs.mkdirSync(output, { recursive: true });
const cloud = options.cloud;
const daily = path.join(cloud, "fedBonds/daily");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const readCsv = file => fs.readFileSync(file, "utf8").trim().split("\n").slice(1).map(line => line.split(","));
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const monthly = new Map(readCsv(path.join(cloud, "CPIAUCSL.csv")).map(([date, value]) => [date, Number(value)]));
const ref = new Map(readCsv(path.join(cloud, "REFCPI.csv")).map(([date, nsa, sa, factor, , horizon]) =>
    [date, { nsa: Number(nsa), sa: Number(sa), factor: Number(factor), horizon }]));
const releases = read(path.join(cloud, "CPI-dates.json")).filter(row => row.rlsDate <= options.through);
const plan = buildResearchPlan(releases, options);
const executionResults = readResearchResults(options.results);
const expectedDates = [...new Set(plan.filter(row => row.included).flatMap(row => [row.pre, row.post]))].sort();
assert.deepEqual(executionResults.map(row => row.date).sort(), expectedDates, "Research results do not cover the requested sampling plan");
const targets = executionResults.filter(row => row.status === "verified").sort((a, b) => a.date.localeCompare(b.date));
assert.ok(targets.length, "No verified research observations; run research-history.mjs --run first");
const variants = [];
for (const valuation of ["settle", "forward"]) {
    for (const adjustment of ["none", "sa", "sa-decay"]) variants.push({
        id: `${valuation}/${adjustment}`, valuation, adjustment,
        suffix: `${valuation === "forward" ? "fwd-" : ""}${adjustment === "none" ? "" : `${adjustment}-`}`,
    });
}
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const mse = values => mean(values.map(value => value * value));
const rms = values => values.length ? Math.sqrt(mse(values)) : null;
const quantile = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (sorted.length - 1) * p, lower = Math.floor(at);
    return sorted[lower] + (sorted[Math.ceil(at)] - sorted[lower]) * (at - lower);
};
const group = (rows, key) => {
    const groups = new Map();
    for (const row of rows) {
        const k = key(row);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(row);
    }
    return groups;
};
const shiftMonth = (date, months) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().slice(0, 10);
};
const calendarDays = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
const holidays = treasuryHolidays(2014, Number(options.through.slice(0, 4)));
function tradingDistance(a, b) {
    return distance(a, b, holidays);
}
function shiftTrading(date, n) {
    return shiftBusiness(date, n, holidays);
}
const classify = (gap, threshold = 0.005) => gap < -threshold ? "below" : gap > threshold ? "above" : "near";
const trend = (event, months = 6) => {
    const end = shiftMonth(event.cpiDate, -1), start = shiftMonth(end, -months);
    assert.ok(monthly.has(end) && monthly.has(start), `Missing trend endpoints: ${event.rlsDate}`);
    return 12 / months * Math.log(monthly.get(end) / monthly.get(start));
};
const earliest = targets.map(row => row.date).sort()[0];
const firstRelease = releases.filter(event => event.rlsDate <= earliest).at(-1)?.rlsDate;
assert.ok(firstRelease, `Missing preceding CPI release for ${earliest}`);
const events = releases.filter(event => event.rlsDate >= firstRelease).map(event => {
    const start = ref.get(event.rlsDate), end = ref.get(event.refcpiDate);
    assert.ok(start && end, `Missing release REFCPI: ${event.rlsDate}`);
    assert.equal(start.horizon, event.refcpiDate);
    const years = calendarDays(event.rlsDate, event.refcpiDate) / 365;
    assert.ok(years > 0);
    const rawCarry = Math.log(end.nsa / start.nsa) / years;
    const saCarry = Math.log(end.sa / start.sa) / years;
    const trend6 = trend(event);
    const sensitive = event.rlsDate >= "2025-10-24" && event.rlsDate <= "2026-06-10";
    return { ...event, rawCarry, saCarry, trend6, gap: rawCarry - trend6, state: classify(rawCarry - trend6), sensitive };
});
const eventMap = new Map(events.map(event => [event.rlsDate, event]));
const closestReleases = releases.filter(event => event.rlsDate >= shiftMonth(earliest, -2));
const sample = targets.map(target => {
    const event = events.filter(event => event.rlsDate <= target.date).at(-1);
    assert.ok(event, `No release for ${target.date}`);
    const nearest = closestReleases.map(release => ({
        date: release.rlsDate, distance: tradingDistance(release.rlsDate, target.date),
    })).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0];
    return {
        date: target.date, selection: target.selection, event: event.rlsDate, state: event.state,
        nearestRelease: nearest.date, releaseTradingDistance: nearest.distance,
        eligible: Math.abs(nearest.distance) > 3 && !exclusionReason(event.rlsDate),
        eligible2: Math.abs(nearest.distance) > 2 && !exclusionReason(event.rlsDate),
        sensitive: event.sensitive,
    };
});
const sampleMap = new Map(sample.map(row => [row.date, row]));
const cacheFile = path.join(output, "cpi-curve-cv-cache.json");
const cache = fs.existsSync(cacheFile) ? read(cacheFile) : {};
const engineHash = createHash("sha256").update([
    "lib/zero/svenssonFit.mjs", "lib/zero/svensson.mjs", "lib/coupons.mjs", "lib/yield.mjs",
    "lib/duration.mjs", "lib/dates.mjs", "lib/rounding.mjs",
].map(name => hash(new URL(`../mktBonds/${name}`, import.meta.url))).concat(
    hash(new URL("./lib/research-pricing.mjs", import.meta.url)),
    hash(new URL("./lib/research-buckets.mjs", import.meta.url)),
    "short-end-errors-v1",
).join("|")).digest("hex");
const measures = [], shortMeasures = [], curveMap = new Map();
const sourceFiles = new Set([
    path.join(cloud, "CPIAUCSL.csv"), path.join(cloud, "REFCPI.csv"), path.join(cloud, "CPI-dates.json"),
]);
function metrics(errors) {
    const subset = predicate => errors.filter(predicate);
    const all = errors, short = subset(row => row.years <= 3), long = subset(row => row.years > 3);
    const middle = subset(row => row.years >= 1 && row.years <= 10);
    const result = {};
    for (const [label, rows] of Object.entries({ all, short, long, middle })) {
        assert.ok(rows.length > 0, `Empty error bucket: ${label}`);
        result[`${label}TipsMse`] = mse(rows.map(row => row.tips));
        result[`${label}BeiMse`] = mse(rows.filter(row => row.bei != null).map(row => row.bei));
        result[`${label}PriceMse`] = mse(rows.map(row => row.price));
    }
    return result;
}
function convertPrediction(row, variant, modelClean, nominalResidual) {
    const modelOriginal = originalSettlementPrice(row, variant, modelClean);
    assert.ok(row.maturity_date.slice(0, 10) > row.fwd_date.slice(0, 10), `Known-inflation TIPS entered research: ${row.cusip}`);
    const settle = normalizeDate(row.settle_date);
    const observedYield = yieldFromPrice(row.settle_date, row.maturity_date, row.interest_rate, row.settle_clean_price);
    const predictedYield = yieldFromPrice(row.settle_date, row.maturity_date, row.interest_rate, modelOriginal);
    assert.ok(Number.isFinite(observedYield) && Number.isFinite(predictedYield));
    const tips = (observedYield - predictedYield) * 10000;
    return {
        cusip: row.cusip, settle: row.settle_date.slice(0, 10), maturity: row.maturity_date.slice(0, 10),
        horizon: row.fwd_date.slice(0, 10), years: daysBetween(settle, normalizeDate(row.maturity_date)) / 365,
        tips, bei: nominalResidual == null ? null : nominalResidual - tips,
        price: row.settle_clean_price - modelOriginal,
    };
}
function shape(curve, nominal) {
    const real = tenor => svenssonZero(tenor, curve.params);
    const bei = tenor => svenssonZero(tenor, nominal.params) - real(tenor);
    const values = {};
    for (const t of [0.5, 1, 2, 5, 10]) {
        values[`real${t}`] = real(t) * 10000;
        values[`bei${t}`] = bei(t) * 10000;
    }
    for (const [lo, hi] of [[0.5, 2], [1, 5], [2, 10]]) {
        values[`realSlope${lo}_${hi}`] = (real(hi) - real(lo)) * 10000;
        values[`beiSlope${lo}_${hi}`] = (bei(hi) - bei(lo)) * 10000;
    }
    return values;
}
const started = Date.now();
for (const [index, target] of sample.entries()) {
    for (const side of ["ask", "bid"]) {
        const tipsFile = path.join(daily, `${target.date}-fedTips-${side}.json`);
        const tips = read(tipsFile), byCusip = new Map(tips.map(row => [row.cusip, row]));
        sourceFiles.add(tipsFile);
        const baselineFile = path.join(daily, `${target.date}-fedTips-curve-${side}.json`);
        const original = read(baselineFile);
        const nominalResiduals = new Map(original.rows.map(row => [row.cusip, row.nominalResidualBp]));
        let referenceCusips = null;
        for (const variant of variants) {
            const curveFile = path.join(daily, `${target.date}-fedTips-curve-${variant.suffix}${side}.json`);
            const nominalFile = path.join(daily, `${target.date}-fedNominal-grid-${variant.valuation === "forward" ? "fwd-" : ""}${side}.json`);
            sourceFiles.add(curveFile); sourceFiles.add(nominalFile);
            const curve = read(curveFile), nominal = read(nominalFile);
            const cusips = curve.rows.map(row => row.cusip).sort();
            if (referenceCusips == null) referenceCusips = cusips;
            else assert.deepEqual(cusips, referenceCusips, `Unequal bond universe: ${target.date} ${side}`);
            assert.equal(curve.settleDate, nominal.settleDate);
            const maturities = [...new Set(curve.rows.map(row => row.maturity))].sort();
            const folds = new Map(maturities.map((maturity, i) => [maturity, i % 3]));
            const inSampleErrors = curve.rows.map(bond =>
                convertPrediction(byCusip.get(bond.cusip), variant, bond.modelClean, nominalResiduals.get(bond.cusip)));
            const sourceHash = `${engineHash}:${hash(curveFile)}:${hash(tipsFile)}:${hash(baselineFile)}`;
            const key = `${target.date}|${side}|${variant.id}`;
            let cv;
            if (cache[key]?.sourceHash === sourceHash) {
                cv = cache[key].cv;
            } else {
                const errors = [];
                for (let fold = 0; fold < 3; fold++) {
                    const training = curve.rows.filter(row => folds.get(row.maturity) !== fold)
                        .map(row => ({ maturity: row.maturity, coupon: row.coupon, cleanPrice: row.marketClean }));
                    const testing = curve.rows.filter(row => folds.get(row.maturity) === fold);
                    assert.ok(training.length >= 6);
                    assert.ok(testing.every(row => !training.some(bond => bond.maturity === row.maturity)));
                    const fit = fitTipsSvensson(curve.settleDate, training);
                    for (const bond of testing) {
                        const modelClean = tipsZeroModelPrice(curve.settleDate, bond.maturity, bond.coupon, fit.params)
                            - accruedInterest(curve.settleDate, bond.maturity, bond.coupon);
                        const trainingDates = training.map(row => row.maturity).sort();
                        errors.push({
                            ...convertPrediction(byCusip.get(bond.cusip), variant, modelClean, nominalResiduals.get(bond.cusip)),
                            extrapolated: bond.maturity < trainingDates[0] || bond.maturity > trainingDates.at(-1),
                        });
                    }
                }
                assert.equal(errors.length, curve.rows.length);
                cv = { ...metrics(errors), bonds: errors.length };
                cache[key] = { sourceHash, cv, errors };
            }
            for (const bucket of SHORT_BUCKETS) {
                const fitted = shortBucketMetrics(inSampleErrors, bucket);
                shortMeasures.push({
                    ...target, side, variant: variant.id, bucket: bucket.id,
                    ...shortBucketMetrics(cache[key].errors, bucket),
                    fitTipsMse: fitted.tipsMse, fitPriceMse: fitted.priceMse,
                });
            }
            const native = curveFitStats(curve);
            const observation = {
                ...target, side, variant: variant.id, valuation: variant.valuation, adjustment: variant.adjustment,
                bonds: inSampleErrors.length,
                beiBonds: inSampleErrors.filter(row => row.bei != null).length,
                minimumMaturityYears: Math.min(...inSampleErrors.map(row => row.years)),
                maximumMaturityYears: Math.max(...inSampleErrors.map(row => row.years)),
                cvExtrapolatedBonds: curve.rows.filter(bond => {
                    const training = maturities.filter(maturity => folds.get(maturity) !== folds.get(bond.maturity));
                    return bond.maturity < training[0] || bond.maturity > training.at(-1);
                }).length,
                horizon: tips[0].fwd_date, gapDays: calendarDays(target.date, tips[0].fwd_date),
                nativeTipsRms: native.rmsBp, nativeShortRms: native.shortRmsBp,
                nativeBeiRms: rms(curve.rows.filter(row => row.beiResidualBp != null).map(row => row.beiResidualBp)),
                nativeObjective: curve.objective, nativeMonthRange: native.monthRangeBp,
                ...Object.fromEntries(Object.entries(metrics(inSampleErrors)).map(([name, value]) => [`fit_${name}`, value])),
                ...Object.fromEntries(Object.entries(cv).map(([name, value]) => [`cv_${name}`, value])),
                ...shape(curve, nominal),
            };
            measures.push(observation);
            curveMap.set(key, { curve, nominal });
        }
    }
    fs.writeFileSync(cacheFile, JSON.stringify(cache));
    console.log(`${index + 1}/${sample.length} measured ${target.date}; eligible=${target.eligible}; regime=${target.state}; elapsed=${Math.round((Date.now() - started) / 1000)}s`);
}

function eventScores(rows, field) {
    return [...group(rows, row => row.event).entries()].map(([event, values]) => ({
        event, value: mean(values.map(row => row[field]).filter(Number.isFinite)),
    })).filter(row => row.value != null);
}
function aggregate(rows, field) {
    const scores = eventScores(rows, field);
    return scores.length ? Math.sqrt(mean(scores.map(row => row.value))) : null;
}
function summarize(rows) {
    return variants.map(variant => {
        const subset = rows.filter(row => row.variant === variant.id);
        const result = {
            variant: variant.id, events: new Set(subset.map(row => row.event)).size,
            dates: new Set(subset.map(row => row.date)).size,
        };
        for (const measure of ["fit", "cv"]) {
            for (const bucket of ["all", "short", "long", "middle"]) {
                for (const kind of ["Tips", "Bei", "Price"]) {
                    const field = `${measure}_${bucket}${kind}Mse`;
                    result[`${measure}_${bucket}${kind}Rmse`] = aggregate(subset, field);
                }
            }
        }
        for (const metric of ["nativeTipsRms", "nativeShortRms", "nativeBeiRms", "nativeMonthRange"]) {
            result[metric] = mean(eventScores(subset, metric).map(row => row.value));
        }
        for (const metric of ["realSlope1_5", "beiSlope1_5", "realSlope2_10", "beiSlope2_10"]) {
            result[`${metric}Mean`] = mean(eventScores(subset, metric).map(row => row.value));
            const signs = subset.map(row => ({ ...row, negative: Number(row[metric] < -2) }));
            result[`${metric}DecliningShare`] = mean(eventScores(signs, "negative").map(row => row.value));
        }
        return result;
    });
}
function ciComparison(rows, best, other, field, iterations = 10000) {
    const a = new Map(eventScores(rows.filter(row => row.variant === best), field).map(row => [row.event, row.value]));
    const b = new Map(eventScores(rows.filter(row => row.variant === other), field).map(row => [row.event, row.value]));
    const ids = [...a.keys()].filter(id => b.has(id));
    assert.ok(ids.length > 0);
    let seed = 1729;
    const random = () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const values = [];
    for (let i = 0; i < iterations; i++) {
        const selected = Array.from({ length: ids.length }, () => ids[Math.floor(random() * ids.length)]);
        values.push(Math.sqrt(mean(selected.map(id => a.get(id)))) - Math.sqrt(mean(selected.map(id => b.get(id)))));
    }
    const differences = ids.map(id => Math.sqrt(a.get(id)) - Math.sqrt(b.get(id)));
    const avg = mean(differences);
    const sd = ids.length > 1 ? Math.sqrt(differences.reduce((s, value) => s + (value - avg) ** 2, 0) / (ids.length - 1)) : null;
    return {
        best, other, events: ids.length,
        differenceBp: Math.sqrt(mean([...a.values()])) - Math.sqrt(mean([...b.values()])),
        lower95: quantile(values, 0.025), upper95: quantile(values, 0.975),
        wins: differences.filter(value => value < 0).length,
        eventRmseDifferenceMean: avg, eventRmseDifferenceSd: sd,
        eventsFor80pctPowerAtObservedEffect: sd == null || Math.abs(avg) < 1e-10 ? null
            : Math.ceil((1.96 + 0.84) ** 2 * sd ** 2 / avg ** 2),
        eventsFor80pctPowerAt1Bp: sd == null ? null : Math.ceil((1.96 + 0.84) ** 2 * sd ** 2),
    };
}
const eligible = measures.filter(row => row.eligible);
const shortSummary = [], shortComparisons = [];
for (const state of ["all", "below", "near", "above"]) {
    for (const bucket of SHORT_BUCKETS) {
        const rows = shortMeasures.filter(row => row.eligible && row.bucket === bucket.id && (state === "all" || row.state === state));
        for (const variant of variants) {
            const set = rows.filter(row => row.variant === variant.id);
            const covered = set.filter(row => row.bonds > 0), matched = set.filter(row => row.beiBonds > 0);
            shortSummary.push({
                state, bucket: bucket.id, variant: variant.id,
                events: new Set(covered.map(row => row.event)).size,
                dates: new Set(covered.map(row => row.date)).size,
                beiEvents: new Set(matched.map(row => row.event)).size,
                beiDates: new Set(matched.map(row => row.date)).size,
                askDates: new Set(covered.filter(row => row.side === "ask").map(row => row.date)).size,
                bidDates: new Set(covered.filter(row => row.side === "bid").map(row => row.date)).size,
                askTipsRmse: aggregate(set.filter(row => row.side === "ask"), "tipsMse"),
                bidTipsRmse: aggregate(set.filter(row => row.side === "bid"), "tipsMse"),
                bondSideObservations: covered.reduce((sum, row) => sum + row.bonds, 0),
                beiBondSideObservations: matched.reduce((sum, row) => sum + row.beiBonds, 0),
                extrapolatedBondSideObservations: covered.reduce((sum, row) => sum + row.extrapolatedBonds, 0),
                minimumUnknownDays: covered.length ? Math.min(...covered.map(row => row.minimumUnknownDays)) : null,
                maximumUnknownDays: covered.length ? Math.max(...covered.map(row => row.maximumUnknownDays)) : null,
                meanUnknownDays: mean(eventScores(covered, "meanUnknownDays").map(row => row.value)),
                tipsRmse: aggregate(set, "tipsMse"), beiRmse: aggregate(set, "beiMse"),
                priceRmse: aggregate(set, "priceMse"),
                fitTipsRmse: aggregate(set, "fitTipsMse"), fitPriceRmse: aggregate(set, "fitPriceMse"),
                interpolatedTipsRmse: aggregate(set, "interpolatedTipsMse"),
                interpolatedEvents: eventScores(set, "interpolatedTipsMse").length,
            });
        }
        for (const field of ["tipsMse", "beiMse", "priceMse"]) {
            const ranked = variants.filter(variant => eventScores(rows.filter(row => row.variant === variant.id), field).length)
                .sort((a, b) => aggregate(rows.filter(row => row.variant === a.id), field)
                    - aggregate(rows.filter(row => row.variant === b.id), field));
            if (ranked.length >= 2) {
                const comparison = ciComparison(rows, ranked[0].id, ranked[1].id, field);
                shortComparisons.push({
                    state, bucket: bucket.id, field, units: field === "priceMse" ? "clean price per 100" : "yield bp",
                    best: comparison.best, other: comparison.other, events: comparison.events,
                    difference: comparison.differenceBp, lower95: comparison.lower95, upper95: comparison.upper95,
                    wins: comparison.wins,
                });
            }
        }
    }
}
const summary = { all: summarize(eligible) };
const comparisons = {};
for (const state of ["below", "near", "above"]) summary[state] = summarize(eligible.filter(row => row.state === state));
for (const [state, rows] of Object.entries({
    all: eligible, below: eligible.filter(row => row.state === "below"),
    near: eligible.filter(row => row.state === "near"), above: eligible.filter(row => row.state === "above"),
})) {
    comparisons[state] = {};
    if (!rows.length) continue;
    for (const field of ["cv_allTipsMse", "cv_shortTipsMse", "cv_allBeiMse", "cv_shortBeiMse",
        "cv_middleTipsMse", "cv_middleBeiMse"]) {
        const ranked = [...variants].sort((a, b) => aggregate(rows.filter(row => row.variant === a.id), field)
            - aggregate(rows.filter(row => row.variant === b.id), field));
        comparisons[state][field] = ranked.slice(1).map(other => ciComparison(rows, ranked[0].id, other.id, field));
    }
}

const sensitivity = [];
for (const window of [2, 3]) {
    for (const carry of ["raw", "sa"]) {
        for (const trendMonths of [3, 6, 12]) {
            for (const threshold of [0.0025, 0.005, 0.01]) {
                const rows = measures.filter(row => window === 3 ? row.eligible : row.eligible2).map(row => {
                    const event = eventMap.get(row.event);
                    return { ...row, state: classify(event[`${carry}Carry`] - trend(event, trendMonths), threshold) };
                });
                for (const state of ["below", "near", "above"]) {
                    const set = rows.filter(row => row.state === state);
                    if (!set.length) continue;
                    const ranked = summarize(set).sort((a, b) => a.cv_allTipsRmse - b.cv_allTipsRmse);
                    const shortRanked = [...ranked].sort((a, b) => a.cv_shortTipsRmse - b.cv_shortTipsRmse);
                    const beiRanked = [...ranked].sort((a, b) => a.cv_allBeiRmse - b.cv_allBeiRmse);
                    sensitivity.push({
                        window, carry, trendMonths, threshold, state, events: ranked[0].events,
                        winnerTips: ranked[0].variant, winnerShortTips: shortRanked[0].variant,
                        winnerBei: beiRanked[0].variant,
                    });
                }
            }
        }
    }
}
const robustness = {};
for (const [name, set] of Object.entries({
    askOnly: eligible.filter(row => row.side === "ask"),
    bidOnly: eligible.filter(row => row.side === "bid"),
    excludeShutdownSensitive: eligible.filter(row => !row.sensitive),
})) {
    robustness[name] = { all: summarize(set) };
    for (const state of ["below", "near", "above"]) robustness[name][state] = summarize(set.filter(row => row.state === state));
}
const cvEventScores = [];
for (const [event, rows] of group(eligible, row => row.event)) {
    for (const variant of variants) {
        const set = rows.filter(row => row.variant === variant.id);
        cvEventScores.push({
            event, state: set[0].state, variant: variant.id,
            tipsRmse: Math.sqrt(mean(set.map(row => row.cv_allTipsMse))),
            shortTipsRmse: Math.sqrt(mean(set.map(row => row.cv_shortTipsMse))),
            beiRmse: Math.sqrt(mean(set.map(row => row.cv_allBeiMse))),
        });
    }
}
const eventPairs = [], sampling = [];
for (const event of events.filter(event => plan.some(row => row.included && row.release === event.rlsDate))) {
    const eventPlan = plan.find(row => row.release === event.rlsDate);
    const pre = sample.find(row => row.eligible && row.date === eventPlan.pre);
    const post = sample.find(row => row.eligible && row.date === eventPlan.post);
    const nearPre = sample.filter(row => row.eligible && tradingDistance(event.rlsDate, row.date) <= -4
        && tradingDistance(event.rlsDate, row.date) >= -10);
    const nearPost = sample.filter(row => row.eligible && tradingDistance(event.rlsDate, row.date) >= 4
        && tradingDistance(event.rlsDate, row.date) <= 10);
    sampling.push({
        release: event.rlsDate, state: event.state, pre: pre?.date ?? null, post: post?.date ?? null,
        plannedPre: eventPlan.pre, plannedPost: eventPlan.post,
        preExcludedEpisode: exclusionReason(sampleMap.get(eventPlan.pre)?.event ?? ""),
        postExcludedEpisode: exclusionReason(sampleMap.get(eventPlan.post)?.event ?? ""),
        existingPre4to10: nearPre.map(row => row.date), existingPost4to10: nearPost.map(row => row.date),
        suggestedPre: nearPre.length || sampleMap.has(eventPlan.pre) ? null : shiftTrading(event.rlsDate, -5),
        suggestedPost: nearPost.length || sampleMap.has(eventPlan.post) ? null : shiftTrading(event.rlsDate, 5),
    });
    if (!pre || !post) continue;
    for (const side of ["ask", "bid"]) {
        for (const variant of variants) {
            const a = measures.find(row => row.date === pre.date && row.side === side && row.variant === variant.id);
            const b = measures.find(row => row.date === post.date && row.side === side && row.variant === variant.id);
            const before = curveMap.get(`${pre.date}|${side}|${variant.id}`);
            const after = curveMap.get(`${post.date}|${side}|${variant.id}`);
            const fixedStart = event.refcpiDate;
            const fixedRate = (data, kind, months) => {
                const startYears = calendarDays(data.curve.settleDate, fixedStart) / 365;
                const endYears = calendarDays(data.curve.settleDate, shiftMonth(fixedStart, months)) / 365;
                assert.ok(startYears >= 0 && endYears > startYears);
                const zero = t => kind === "real" ? svenssonZero(t, data.curve.params)
                    : svenssonZero(t, data.nominal.params) - svenssonZero(t, data.curve.params);
                return (zero(endYears) * endYears - zero(startYears) * startYears) / (endYears - startYears) * 10000;
            };
            const result = {
                event: event.rlsDate, state: event.state, pre: pre.date, post: post.date,
                preTradingDays: -tradingDistance(event.rlsDate, pre.date),
                postTradingDays: tradingDistance(event.rlsDate, post.date),
                side, variant: variant.id,
            };
            for (const kind of ["real", "bei"]) {
                const preSlope = a[`${kind}Slope1_5`], postSlope = b[`${kind}Slope1_5`];
                result[`${kind}PreSlope`] = preSlope;
                result[`${kind}PostSlope`] = postSlope;
                result[`${kind}DownToUp`] = preSlope < -2 && postSlope > 2;
                result[`${kind}UpToDown`] = preSlope > 2 && postSlope < -2;
                const preFixedSlope = fixedRate(before, kind, 60) - fixedRate(before, kind, 12);
                const postFixedSlope = fixedRate(after, kind, 60) - fixedRate(after, kind, 12);
                result[`${kind}FixedPreSlope`] = preFixedSlope;
                result[`${kind}FixedPostSlope`] = postFixedSlope;
                result[`${kind}FixedDownToUp`] = preFixedSlope < -2 && postFixedSlope > 2;
                result[`${kind}FixedUpToDown`] = preFixedSlope > 2 && postFixedSlope < -2;
                result[`${kind}Fixed1yMove`] = fixedRate(after, kind, 12) - fixedRate(before, kind, 12);
                for (const [lo, hi] of [[0.5, 2], [1, 5], [2, 10]]) {
                    const label = `${kind}${lo}to${hi}`;
                    const rawPre = a[`${kind}Slope${lo}_${hi}`], rawPost = b[`${kind}Slope${lo}_${hi}`];
                    result[`${label}PreSlope`] = rawPre;
                    result[`${label}PostSlope`] = rawPost;
                    result[`${label}DownToUp`] = rawPre < -2 && rawPost > 2;
                    result[`${label}UpToDown`] = rawPre > 2 && rawPost < -2;
                    const alignedPre = fixedRate(before, kind, hi * 12) - fixedRate(before, kind, lo * 12);
                    const alignedPost = fixedRate(after, kind, hi * 12) - fixedRate(after, kind, lo * 12);
                    result[`${label}FixedDownToUp`] = alignedPre < -2 && alignedPost > 2;
                    result[`${label}FixedUpToDown`] = alignedPre > 2 && alignedPost < -2;
                }
            }
            eventPairs.push(result);
        }
    }
}
const pairSummary = [];
for (const state of ["all", "below", "near", "above"]) {
    for (const variant of variants) {
        const set = eventPairs.filter(row => row.variant === variant.id && (state === "all" || row.state === state));
        const n = new Set(set.map(row => row.event)).size;
        if (!n) continue;
        const result = { state, variant: variant.id, events: n };
        for (const kind of ["real", "bei"]) {
            for (const flip of ["DownToUp", "UpToDown", "FixedDownToUp", "FixedUpToDown"]) {
                result[`${kind}${flip}MeanSides`] = [...group(set, row => row.event).values()]
                    .reduce((sum, rows) => sum + mean(rows.map(row => Number(row[`${kind}${flip}`]))), 0);
            }
            result[`${kind}Fixed1yMoveRms`] = rms(set.map(row => row[`${kind}Fixed1yMove`]));
        }
        pairSummary.push(result);
    }
}
const manifest = [...sourceFiles].sort().map(file => ({ file, sha256: hash(file) }));
const results = {
    methodology: {
        cutoff: options.through, from: options.from, exclusionTradingDays: 3, trendMonths: 6, nearThresholdAnnualized: 0.005,
        regime: "log(NSA REFCPI at maxREFCPI / NSA REFCPI at announcement) / ACT365 years minus prior-six-month annualized SA trend, ending one CPI reference month before the release",
        aggregation: "Equal-weight CPI release episodes; within each episode equal-weight snapshot/side MSE; square root after aggregation",
        cv: "Three folds, sorted unique maturity dates allocated round-robin; all reopenings of one maturity held out together; all six variants use identical folds and bonds",
        commonPrice: "Invert clean-price seasonal multiplier and affine indexed repo carry, using archived transformations; evaluate original settlement yield/price errors",
        bei: "Common settlement nominal residual minus common settlement TIPS residual; conditional on fitted nominal curve and local nominal-yield interpolation",
        shortEnd: "Calendar-month anniversaries from original settlement, clamped at month end: (0,6], (3,12], (6,12]; maturity must exceed historical maxREFCPI. Empty date/side buckets remain null, not zero; episodes with available scores receive equal weight. Curves train on the full eligible maturity universe.",
        uncertainty: "Paired release-episode bootstrap, 10000 resamples, fixed seed 1729; exploratory, not multiplicity-adjusted",
        shutdownSensitivity: "Exclude release episodes from 2025-10-24 through 2026-06-10 (disrupted releases and six-month trends that depend on gap-filled October 2025)",
    },
    plan, executionResults, events, sample, summary, comparisons, shortSummary, shortComparisons,
    sensitivity, robustness, cvEventScores, eventPairs, pairSummary, sampling,
    counts: {
        allDates: sample.length, strictDates: sample.filter(row => row.eligible).length,
        strictEvents: new Set(eligible.map(row => row.event)).size,
        excludedDates: sample.filter(row => !row.eligible),
        crossValidationRefits: measures.length * 3,
        curves: measures.length,
        requiredAdditionalPairedDates: sampling.flatMap(row => [row.suggestedPre, row.suggestedPost]).filter(Boolean).length,
        pairedEvents: new Set(eventPairs.map(row => row.event)).size,
    },
};
function writeCsv(name, rows) {
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = value => `"${String(typeof value === "object" && value != null ? JSON.stringify(value) : value ?? "").replaceAll('"', '""')}"`;
    fs.writeFileSync(path.join(output, name), `${keys.map(cell).join(",")}\n${rows.map(row => keys.map(key => cell(row[key])).join(",")).join("\n")}\n`);
}
fs.writeFileSync(path.join(output, "cpi-curve-analysis.json"), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(output, "cpi-curve-input-hashes.json"), JSON.stringify(manifest, null, 2));
writeCsv("cpi-curve-observations.csv", measures);
writeCsv("cpi-curve-regimes.csv", events);
writeCsv("cpi-curve-summary.csv", Object.entries(summary).flatMap(([state, rows]) => rows.map(row => ({ state, ...row }))));
writeCsv("cpi-curve-release-pairs.csv", eventPairs);
writeCsv("cpi-curve-sampling-plan.csv", sampling);
writeCsv("cpi-curve-short-end.csv", shortSummary);
writeCsv("cpi-curve-short-observations.csv", shortMeasures);
const lines = [
    "# CPI-conditioned fedBonds curve study",
    "",
    `Range: ${options.from} through ${options.through}.`,
    `Verified dates: ${sample.length}; primary dates: ${results.counts.strictDates}; scored release episodes: ${results.counts.strictEvents}.`,
    `Blocked dates: ${executionResults.filter(row => row.status === "blocked").length}.`,
    "",
    "Primary exclusions: March 2020–December 2022 and October–December 2025 CPI releases.",
    "January–June 2026 CPI-filled trend risk is retained in the primary sample and removed in the separate sensitivity results.",
    "Pre-release observations whose latest available CPI episode is excluded are also excluded from primary regime scores.",
    "",
    "Errors below are maturity-grouped three-fold cross-validation RMSE in original settlement yield basis points.",
    "Release episodes receive equal weight; quote sides are not independent events.",
    "BEI errors are conditional on the fitted nominal curve, not independent traded BEI observations.",
    "BEI scores omit bonds without a matched nominal residual; observation-level bonds/beiBonds columns disclose this coverage difference.",
    "All-maturity yield scores can be dominated by very short held-out bonds outside the training maturity range. The 1–10-year comparison below is an important separate robustness check, not a replacement or deletion of these observations.",
    "",
    "| Regime | Episodes | Dates | Variant | TIPS RMSE bp | Short TIPS RMSE bp | BEI RMSE bp |",
    "|---|---:|---:|---|---:|---:|---:|",
];
for (const state of ["below", "near", "above", "all"]) {
    for (const row of summary[state]) {
        const format = value => value == null ? "n/a" : value.toFixed(3);
        lines.push(`| ${state} | ${row.events} | ${row.dates} | ${row.variant} | ${format(row.cv_allTipsRmse)} | ${format(row.cv_shortTipsRmse)} | ${format(row.cv_allBeiRmse)} |`);
    }
}
lines.push("", "## Short-end maturity comparison", "",
    "Buckets are measured from original settlement using calendar-month anniversaries (clamped at month end): (0,6], (3,12], and (6,12]. The 3–12-month bucket intentionally overlaps the others.",
    "Every scored bond must mature strictly after its historical maxREFCPI date. The full eligible curve universe is used for fitting, not a separate Svensson fit on a handful of short bonds.",
    "Empty date/side buckets remain missing, not zero. Each bucket and metric averages only episodes with available observations. BEI coverage can be smaller than TIPS coverage.",
    "Price errors are per 100 of original settlement clean price, not inflation-adjusted dollars. Yield errors are bp. Small price errors near maturity can imply large annualized yield errors.",
    "Unknown days measure maturity minus maxREFCPI, not maturity minus settlement. Bond observations include repeated dates and both sides, not independent securities or events.", "",
    "| Regime | Bucket | Variant | Episodes / dates | Ask / bid dates | BEI episodes / dates | CV TIPS bp | CV BEI bp | CV price / 100 | Fit TIPS bp | Extrapolated / bond-side observations | Unknown days min–max |",
    "|---|---|---|---|---|---|---:|---:|---:|---:|---|---|");
const shortFormat = value => value == null ? "n/a" : value.toFixed(3);
for (const row of shortSummary) {
    lines.push(`| ${row.state} | ${row.bucket} | ${row.variant} | ${row.events} / ${row.dates} | ${row.askDates} / ${row.bidDates} | ${row.beiEvents} / ${row.beiDates} | ${shortFormat(row.tipsRmse)} | ${shortFormat(row.beiRmse)} | ${shortFormat(row.priceRmse)} | ${shortFormat(row.fitTipsRmse)} | ${row.extrapolatedBondSideObservations} / ${row.bondSideObservations} | ${row.minimumUnknownDays ?? "n/a"}–${row.maximumUnknownDays ?? "n/a"} |`);
}
for (const row of shortSummary.filter(row => row.state === "all" && row.variant === variants[0].id)) {
    if (!row.askDates || !row.bidDates) lines.push("",
        `**${row.bucket} coverage limitation:** ${row.askDates} ask dates and ${row.bidDates} bid dates. An absent side is missing, not a zero-error result; this bucket cannot validate performance on both quote sides.`);
}
lines.push("", "### Short-end leaders and runner-up uncertainty", "",
    "Differences favor the leader when negative. These are exploratory paired episode bootstrap intervals; overlapping buckets, repeated securities, and adjacent months are not independent replications.",
    "The price interval is in price per 100, not bp. A descriptive yield winner need not be the price winner.", "",
    "| Regime | Bucket | Score | Leader | Runner-up | Difference | 95% interval | Episodes |",
    "|---|---|---|---|---|---:|---:|---:|");
for (const row of shortComparisons) {
    lines.push(`| ${row.state} | ${row.bucket} | ${row.field === "priceMse" ? "Price / 100" : row.field === "tipsMse" ? "TIPS bp" : "BEI bp"} | ${row.best} | ${row.other} | ${shortFormat(row.difference)} | [${shortFormat(row.lower95)}, ${shortFormat(row.upper95)}] | ${row.events} |`);
}
lines.push("", "Full coverage, fit-price errors, mean unknown days, and interpolation-only diagnostics are in [the short-end table](./cpi-curve-short-end.csv).",
    "Interpolation-only errors are a selected diagnostic subset, not a replacement for the full holdout score; the shortest bond will often require extrapolation when held out.",
    "A large fit-versus-holdout gap warns against treating an attractive fitted short-end shape as predictive accuracy.", "");
lines.push("", "## One- to ten-year maturity comparison", "",
    "The holdout fits still train on the same full bond universe; this table scores only original settlement maturities from one through ten years.",
    "This separates better-supported tenors from near-maturity yield sensitivity and extrapolation.", "",
    "| Regime | Variant | TIPS RMSE bp | BEI proxy RMSE bp | TIPS above 3 years RMSE bp |",
    "|---|---|---:|---:|---:|");
for (const state of ["below", "near", "above", "all"]) {
    for (const row of summary[state]) {
        const format = value => value == null ? "n/a" : value.toFixed(3);
        lines.push(`| ${state} | ${row.variant} | ${format(row.cv_middleTipsRmse)} | ${format(row.cv_middleBeiRmse)} | ${format(row.cv_longTipsRmse)} |`);
    }
}
lines.push("", "## Leaders and uncertainty", "",
    "Negative differences favor the descriptive leader. Intervals resample whole release episodes; they are exploratory and not adjusted for selecting the best of six curves.",
    "Monthly episodes can remain serially correlated, so the intervals and sample-size estimates should not be treated as definitive significance tests.", "",
    "| Regime | Score | Leader | Runner-up | Difference bp | 95% interval bp | Episodes |",
    "|---|---|---|---|---:|---:|---:|");
for (const state of ["below", "near", "above", "all"]) {
    for (const [field, label] of [["cv_allTipsMse", "TIPS"], ["cv_allBeiMse", "BEI proxy"],
        ["cv_middleTipsMse", "1–10y TIPS"], ["cv_middleBeiMse", "1–10y BEI proxy"]]) {
        const comparison = comparisons[state][field]?.[0];
        if (!comparison) continue;
        lines.push(`| ${state} | ${label} | ${comparison.best} | ${comparison.other} | ${comparison.differenceBp.toFixed(3)} | [${comparison.lower95.toFixed(3)}, ${comparison.upper95.toFixed(3)}] | ${comparison.events} |`);
    }
}
lines.push("", "## Release-pair shape changes", "",
    `Complete primary -5/+5 pairs: ${results.counts.pairedEvents} of ${plan.filter(row => row.included).length} selected releases.`,
    "A pair can be absent because its pre-release snapshot is governed by an excluded prior episode; taking more quotes on that same date would not repair the policy exclusion.",
    "The counts below average the two quote sides within each release. A flip requires slopes on opposite sides of +/-2 bp.",
    "Fixed-start slopes compare one- and five-year rates starting at the same post-release maxREFCPI date, avoiding a moving-forward-date comparison.", "",
    "| Variant | BEI down-to-up | BEI up-to-down | Fixed-start BEI down-to-up | Fixed-start BEI up-to-down | Fixed-start real down-to-up |",
    "|---|---:|---:|---:|---:|---:|");
for (const row of pairSummary.filter(row => row.state === "all")) {
    lines.push(`| ${row.variant} | ${row.beiDownToUpMeanSides} | ${row.beiUpToDownMeanSides} | ${row.beiFixedDownToUpMeanSides} | ${row.beiFixedUpToDownMeanSides} | ${row.realFixedDownToUpMeanSides} |`);
}
lines.push("", "## Coverage and additional observations", "",
    `Missing suggested -5/+5 observations: ${results.counts.requiredAdditionalPairedDates}.`,
    "Planning estimates below target a 1 bp difference between each regime's TIPS leader and runner-up, at 80% power and a two-sided 5% threshold.",
    "They use observed episode-to-episode dispersion, ignore serial dependence and model selection, and are rough planning numbers rather than a guarantee.", "",
    "| Regime | TIPS score | Scored release episodes | Estimated total episodes for 1 bp | Estimated additional episodes |",
    "|---|---|---:|---:|---:|");
for (const state of ["below", "near", "above"]) {
    for (const [field, label] of [["cv_allTipsMse", "All maturities"], ["cv_middleTipsMse", "1–10 years"]]) {
        const comparison = comparisons[state][field]?.[0];
        if (!comparison) continue;
        const needed = comparison.eventsFor80pctPowerAt1Bp;
        lines.push(`| ${state} | ${label} | ${comparison.events} | ${needed ?? "n/a"} | ${needed == null ? "n/a" : Math.max(0, needed - comparison.events)} |`);
    }
}
lines.push("", "Large all-maturity sample requirements can reflect unstable short-end extrapolation; collecting more dates alone does not fix that modeling limitation.");
lines.push("", "Lowest error is descriptive, not proof of a universal winner. Full pairwise intervals and sensitivity results are in [the JSON results](./cpi-curve-analysis.json).",
    "Real-yield and BEI curves are not theoretically required to slope upward.",
    "Findings are conditional on excluding the pandemic/rebound and shutdown episodes; they do not establish performance in those regimes.",
    "This is a current-vintage historical-price replay, not a point-in-time backtest or realized-return study.",
    "The [observation CSV](./cpi-curve-observations.csv), [release pairs](./cpi-curve-release-pairs.csv), [sampling plan](./cpi-curve-sampling-plan.csv), execution statuses, and source hashes accompany this report.", "");
fs.writeFileSync(path.join(output, "analysis.md"), lines.join("\n"));
console.log(JSON.stringify({ counts: results.counts, summaries: summary }, null, 2));
