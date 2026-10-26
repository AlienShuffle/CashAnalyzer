import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseResearchOptions, readResearchResults } from "./lib/research-options.mjs";
import { dailyReportDirectory, archivedInputPath } from "./lib/daily-archive.mjs";
import { buildResearchPlan } from "./lib/research-calendar.mjs";
import { SHORT_BUCKETS, addMonths, inShortBucket } from "./lib/research-buckets.mjs";
import { mean, grouped, episodeMeans, referenceYield, carryRelationship, episodeInfluence } from "./lib/research-experiment.mjs";
import { pairedMeanInterval } from "./lib/research-counterfactual.mjs";
import { fitNearestFlatReference, flatReferencePrice } from "./lib/research-flat-reference.mjs";
import { releaseCpiPath, commonStartRatio, commonStartPrice, commonStartRepo,
    releasePriceCube, releaseDecomposition } from "./lib/research-release.mjs";
import { parseRefCpiCsv, createRefCpiTable } from "../mktBonds/lib/tips/refCpi.mjs";
import { roundPrice } from "../mktBonds/lib/rounding.mjs";
import { normalizeDate, daysBetween } from "../mktBonds/lib/dates.mjs";

const options = parseResearchOptions(process.argv.slice(2));
const sources = new Map();
const hash = file => createHash("sha256").update(fs.readFileSync(archivedInputPath(file))).digest("hex");
function input(file) {
    const text = fs.readFileSync(file, "utf8");
    sources.set(file instanceof URL ? file.pathname : file, createHash("sha256").update(text).digest("hex"));
    return text;
}
const read = file => JSON.parse(input(file));
const iso = value => {
    const date = normalizeDate(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const study = read(path.join(options.output, "cpi-curve-analysis.json"));
assert.equal(study.methodology.from, options.from);
assert.equal(study.methodology.cutoff, options.through);
input(options.results);
assert.deepEqual(readResearchResults(options.results), study.executionResults, "Execution ledger changed; rerun analyze-history");
const plan = buildResearchPlan(read(path.join(options.cloud, "CPI-dates.json")), options);
assert.deepEqual(plan, study.plan, "Release plan changed; rerun analyze-history");
for (const source of read(path.join(options.output, "cpi-curve-input-hashes.json"))) {
    assert.equal(hash(source.file), source.sha256, `Historical input changed: ${source.file}`);
    sources.set(source.file, source.sha256);
}
for (const name of [
    "decompose-release.mjs", "lib/research-release.mjs", "lib/research-options.mjs", "lib/research-calendar.mjs",
    "lib/research-buckets.mjs", "lib/research-experiment.mjs", "lib/research-counterfactual.mjs",
    "lib/research-flat-reference.mjs", "lib/research-pricing.mjs", "../mktBonds/lib/tips/refCpi.mjs",
    "../mktBonds/lib/tips/credibility.mjs", "../mktBonds/lib/forwards/forwardPrice.mjs",
    "../mktBonds/lib/forwards/index.mjs", "../mktBonds/lib/forwards/forwardRate.mjs",
    "../mktBonds/lib/forwards/tbill.mjs", "../mktBonds/lib/rounding.mjs", "../lib/utils.mjs",
    "../mktBonds/lib/coupons.mjs", "../mktBonds/lib/dates.mjs", "../mktBonds/lib/yield.mjs",
]) input(new URL(name, import.meta.url));
const cpi = parseRefCpiCsv(input(path.join(options.cloud, "REFCPI.csv")));
const samples = new Map(study.sample.map(row => [row.date, row]));
const events = new Map(study.events.map(row => [row.rlsDate, row]));
const selected = plan.filter(row => row.included);
const observations = [], cubes = [], fits = [], coverage = [], unmatched = [], paths = [];
const financing = [];
let completePairs = 0, maxPriceIdentityError = 0, maxYieldIdentityError = 0, bracketedYields = 0;
let archivedPriceChecks = 0, maxArchivedPriceDifference = 0;
const getYield = (start, bond, clean) => {
    const result = referenceYield(start, bond.maturity_date, bond.interest_rate, clean);
    if (result.bracketed) bracketedYields++;
    return result.value * 10000;
};
const components = ["quote", "cpi", "context", "reference", "netQuote", "netCpi", "netContext"];
const fitComponents = ["fitQuoteImprovement", "fitCpiImprovement", "fitContextImprovement"];
for (const release of selected) {
    const pre = samples.get(release.pre), post = samples.get(release.post);
    if (!pre?.eligible || !post?.eligible) {
        coverage.push({
            event: release.release, preDate: release.pre, postDate: release.post, status: "excluded-governing-episode",
            preEligible: pre?.eligible ?? false, postEligible: post?.eligible ?? false,
        });
        continue;
    }
    completePairs++;
    const event = events.get(release.release), prior = events.get(pre.event);
    assert.ok(event && prior && pre.event < release.release && post.event === release.release, "Invalid governing release labels");
    const common = release.horizon;
    const tables = [createRefCpiTable(cpi, { asOfDate: release.pre }), createRefCpiTable(cpi, { asOfDate: release.post })];
    const preHorizon = iso(tables[0].maxDate);
    assert.ok(preHorizon < common && iso(tables[1].maxDate) === common, "Unexpected common-start CPI horizons");
    const cpiPaths = tables.map((table, index) => releaseCpiPath(table, common, index ? event.trend6 : prior.trend6));
    paths.push({
        event: release.release, preDate: release.pre, postDate: release.post, state: event.state,
        preGoverningRelease: pre.event, preHorizon, commonStart: common, preTrend: prior.trend6,
        preKnownHorizonCpi: cpiPaths[0](preHorizon), projectedCommonCpi: cpiPaths[0](common),
        actualCommonCpi: cpiPaths[1](common),
        newSegmentAnnualizedGapPp: Math.log(cpiPaths[1](common) / cpiPaths[0](common))
            / (daysBetween(normalizeDate(preHorizon), normalizeDate(common)) / 365) * 100,
        announcementGapPp: event.gap * 100,
    });
    const snapshots = [release.pre, release.post].map(date => {
        const quotes = read(path.join(dailyReportDirectory(options.cloud), `${date}-rate.json`));
        assert.ok(quotes.length && quotes.every(row => row.asOfDate.slice(0, 10) === date), "Bill snapshot date differs");
        return quotes;
    });
    for (const side of ["ask", "bid"]) {
        const data = [release.pre, release.post].map(date =>
            read(path.join(dailyReportDirectory(options.cloud), `${date}-fedTips-${side}.json`)));
        assert.ok(data.every(rows => rows.length), "Empty quote snapshot");
        const maps = data.map(rows => new Map(rows.map(row => [row.cusip, row])));
        const repos = snapshots.map((quotes, index) => commonStartRepo(quotes, side, data[index][0].settle_date, common));
        for (const [index, repo] of repos.entries()) financing.push({
            event: release.release, side, snapshot: index === 0 ? "pre" : "post",
            date: index === 0 ? release.pre : release.post, settle: data[index][0].settle_date.slice(0, 10),
            commonStart: common, archivedHorizon: data[index][0].fwd_date.slice(0, 10),
            archivedRepo: data[index][0].repo_rate, commonRepo: repo.rate,
            beforeMaturity: iso(repo.before.maturity), beforePrice: repo.before.price,
            afterMaturity: iso(repo.after.maturity), afterPrice: repo.after.price,
        });
        for (const [index, map] of maps.entries()) assert.equal(map.size, data[index].length, "Duplicate source CUSIP");
        const matched = [];
        for (const cusip of [...new Set(data.flatMap(rows => rows.map(row => row.cusip)))].sort()) {
            const before = maps[0].get(cusip), after = maps[1].get(cusip);
            const maturity = (after ?? before).maturity_date.slice(0, 10);
            const reason = maturity <= common ? "maturity-on-or-before-common-start"
                : !before ? "missing-pre-quote" : !after ? "missing-post-quote" : null;
            if (reason) {
                unmatched.push({ event: release.release, side, cusip, maturity, commonStart: common, reason });
                continue;
            }
            for (const [index, row] of [before, after].entries()) {
                assert.ok(row.settle_clean_price > 0 && Number.isFinite(row.repo_rate));
                assert.equal(row.asOfDate.slice(0, 10), index === 0 ? release.pre : release.post, "Quote snapshot date differs");
                assert.equal(row.fwd_date.slice(0, 10), iso(tables[index].maxDate));
                assert.equal(tables[index].getRefCpi(row.settle_date), row.settle_refcpi);
                assert.equal(tables[index].getRefCpi(row.fwd_date), row.fwd_refcpi);
                assert.equal(commonStartRepo(snapshots[index], side, row.settle_date, row.fwd_date).rate,
                    row.repo_rate, "Archived financing reconstruction differs");
                if (index === 1) assert.equal(repos[index].rate, row.repo_rate, "Post common-start financing differs");
                const reconstructed = commonStartPrice(row, row.settle_clean_price, cpiPaths[index], row.fwd_date, 1);
                const difference = Math.abs(reconstructed - row.fwd_clean_price);
                maxArchivedPriceDifference = Math.max(maxArchivedPriceDifference, difference);
                assert.ok(difference < 1e-8, "Original-horizon forward reconstruction differs from archive");
                archivedPriceChecks++;
            }
            matched.push({
                before: { ...before, repo_rate: repos[0].rate }, after: { ...after, repo_rate: repos[1].rate },
                cusip, maturity,
            });
        }
        assert.ok(matched.length >= 3, "Insufficient matched universe");
        const settle = matched[0].before.settle_date.slice(0, 10);
        const postSettle = matched[0].after.settle_date.slice(0, 10);
        assert.ok(settle < postSettle && postSettle < common);
        assert.ok(matched.every(bond => bond.before.settle_date.slice(0, 10) === settle
            && bond.after.settle_date.slice(0, 10) === postSettle), "Mixed settlement dates");
        const testing = matched.filter(bond => bond.maturity <= addMonths(settle, 12));
        const sensitive = pre.sensitive || post.sensitive || release.filledCpiTrendRisk;
        for (const adjustment of ["none", "sa", "sa-decay"]) {
            const priceCubes = new Map(matched.map(bond => [bond.cusip, releasePriceCube(
                bond.before, bond.after, cpiPaths, common,
                tables.map(table => commonStartRatio(table, common, bond.maturity, adjustment)),
            )]));
            // The post corner must reproduce the published forward transformation exactly.
            for (const bond of matched) {
                const ratio = adjustment === "none" ? 1
                    : bond.after[`fwd_mature_sa_ratio${adjustment === "sa-decay" ? "_decay" : ""}`];
                const difference = Math.abs(priceCubes.get(bond.cusip)[7] - bond.after.fwd_clean_price * ratio);
                assert.ok(difference < 1e-8, "Post common-start reconstruction differs from archive");
            }
            for (const cutoff of [12, 18, 24]) {
                const training = matched.filter(bond => bond.maturity > addMonths(settle, cutoff))
                    .sort((a, b) => a.maturity.localeCompare(b.maturity) || a.cusip.localeCompare(b.cusip)).slice(0, 3);
                assert.equal(training.length, 3, "Insufficient matched reference support");
                assert.ok(training.every(bond => !testing.some(test => test.cusip === bond.cusip)), "Training leakage");
                const refFits = Array.from({ length: 8 }, (_, mask) => fitNearestFlatReference(common, training.map(bond => ({
                    cusip: bond.cusip, maturity: bond.maturity, coupon: bond.before.interest_rate,
                    cleanPrice: roundPrice(priceCubes.get(bond.cusip)[mask]),
                }))));
                for (const [mask, fit] of refFits.entries()) fits.push({
                    event: release.release, side, adjustment, cutoff, mask, commonStart: common,
                    trainingCusips: fit.trainingCusips.join(";"), trainingMinimum: fit.trainingMinimum,
                    trainingMaximum: fit.trainingMaximum, rate: fit.rate, trainingPriceRmse: fit.trainingPriceRmse,
                    trainingPrices: training.map(bond => roundPrice(priceCubes.get(bond.cusip)[mask])).join(";"),
                });
                if (adjustment === "none") for (const bucket of SHORT_BUCKETS) coverage.push({
                    event: release.release, preDate: release.pre, postDate: release.post, side, cutoff, bucket: bucket.id,
                    status: "complete-pair", state: event.state, sensitive, commonStart: common,
                    preQuotes: data[0].length, postQuotes: data[1].length, matchedEligible: matched.length,
                    testBonds: testing.filter(bond => inShortBucket({ settle, horizon: common, maturity: bond.maturity }, bucket)).length,
                    trainingCusips: training.map(bond => bond.cusip).join(";"),
                });
                for (const bond of testing) {
                    const marketPrices = priceCubes.get(bond.cusip);
                    const refPrices = refFits.map(fit => flatReferencePrice(common, bond.maturity, bond.before.interest_rate, fit.rate));
                    const marketYields = marketPrices.map(price => getYield(common, bond.before, price));
                    const refYields = refPrices.map(price => getYield(common, bond.before, price));
                    const metadata = {
                        event: release.release, date: release.post, preDate: release.pre, postDate: release.post,
                        preEvent: pre.event, state: event.state, sensitive, gapPp: event.gap * 100,
                        side, adjustment, cutoff, cusip: bond.cusip, settle, postSettle, horizon: common, maturity: bond.maturity,
                        unknownDays: daysBetween(normalizeDate(common), normalizeDate(bond.maturity)),
                        trainingCusips: training.map(row => row.cusip).join(";"),
                    };
                    for (let mask = 0; mask < 8; mask++) cubes.push({
                        ...metadata, mask, marketPrice: marketPrices[mask], referencePrice: refPrices[mask],
                        marketYieldBp: marketYields[mask], referenceYieldBp: refYields[mask],
                    });
                    for (const [metric, market, reference] of [["price", marketPrices, refPrices], ["yield", marketYields, refYields]]) {
                        const decomposition = releaseDecomposition(market, reference);
                        const error = Math.abs(components.slice(0, 4).reduce((sum, key) => sum + decomposition[key], 0) - decomposition.change);
                        if (metric === "price") maxPriceIdentityError = Math.max(maxPriceIdentityError, error);
                        else maxYieldIdentityError = Math.max(maxYieldIdentityError, error);
                        observations.push({
                            ...metadata, metric, ...decomposition,
                            beforeSquared: decomposition.before ** 2, afterSquared: decomposition.after ** 2,
                            squaredImprovement: decomposition.before ** 2 - decomposition.after ** 2,
                            ...Object.fromEntries(components.map(key => [`${key}Squared`, decomposition[key] ** 2])),
                        });
                    }
                }
            }
        }
    }
    console.log(`${completePairs} release pairs: ${release.release}`);
}
const summary = [], relationships = [], influence = [];
const scopes = {
    primary: () => true, ask: row => row.side === "ask", bid: row => row.side === "bid",
    excludeShutdownSensitive: row => !row.sensitive,
};
const scoreFields = ["before", "after", "change", "beforeSquared", "afterSquared", "squaredImprovement",
    ...components, ...components.map(key => `${key}Squared`), ...fitComponents];
for (const bucket of SHORT_BUCKETS) {
    const bucketRows = observations.filter(row => inShortBucket(row, bucket));
    for (const [scope, select] of Object.entries(scopes)) {
        for (const rows of grouped(bucketRows.filter(select), row => `${row.cutoff}|${row.adjustment}|${row.metric}`)) {
            for (const state of ["all", "below", "near", "above"]) {
                const set = rows.filter(row => state === "all" || row.state === state);
                if (!set.length) continue;
                const episodes = episodeMeans(set, scoreFields);
                const row = {
                    scope, bucket: bucket.id, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment,
                    metric: rows[0].metric, state, events: episodes.length, bondSideObservations: set.length,
                    beforeRmse: Math.sqrt(mean(episodes.map(row => row.beforeSquared))),
                    afterRmse: Math.sqrt(mean(episodes.map(row => row.afterSquared))),
                    signedBefore: mean(episodes.map(row => row.before)), signedAfter: mean(episodes.map(row => row.after)),
                    signedChange: mean(episodes.map(row => row.change)),
                    ...Object.fromEntries(components.flatMap(key => {
                        const interval = pairedMeanInterval(episodes, key);
                        return [[key, interval.mean], [`${key}Lower95`, interval.lower95], [`${key}Upper95`, interval.upper95],
                            [`${key}Rms`, Math.sqrt(mean(episodes.map(row => row[`${key}Squared`])))]];
                    })),
                };
                const improvement = pairedMeanInterval(episodes, "squaredImprovement");
                summary.push({
                    ...row, squaredImprovement: improvement.mean, lower95: improvement.lower95, upper95: improvement.upper95,
                    ...Object.fromEntries(fitComponents.flatMap(key => {
                        const interval = pairedMeanInterval(episodes, key);
                        return [[key, interval.mean], [`${key}Lower95`, interval.lower95], [`${key}Upper95`, interval.upper95]];
                    })),
                });
            }
            const episodes = episodeMeans(rows, scoreFields);
            for (const field of ["netCpi", "change"]) relationships.push({
                scope, bucket: bucket.id, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment,
                metric: rows[0].metric, field, ...carryRelationship(episodes, field),
            });
            if (scope === "primary") {
                const byEvent = new Map(grouped(rows, row => row.event).map(set => [set[0].event, set]));
                influence.push(...episodeInfluence(episodes, "squaredImprovement").map(row => ({
                    bucket: bucket.id, cutoff: rows[0].cutoff, adjustment: rows[0].adjustment, metric: rows[0].metric,
                    ...row, preDate: byEvent.get(row.event)[0].preDate, postDate: byEvent.get(row.event)[0].postDate,
                    cusips: [...new Set(byEvent.get(row.event).map(row => row.cusip))].sort().join(";"),
                })));
            }
        }
    }
}
const verification = {
    plannedPairs: selected.length, completePairs, excludedPairs: selected.length - completePairs,
    dateSides: paths.length * 2, commonStartPaths: paths.length,
    commonStartFinancingRows: financing.length,
    observations: observations.length, hybridStates: cubes.length, referenceCalibrations: fits.length,
    summaryRows: summary.length, coverageRows: coverage.length, unmatchedRows: unmatched.length,
    influenceRows: influence.length, relationshipRows: relationships.length,
    maxPriceIdentityError, maxYieldIdentityError, bracketedYieldInversions: bracketedYields,
    archivedPriceChecks, maxArchivedPriceDifference,
    knownInflationViolations: observations.filter(row => row.maturity <= row.horizon).length,
    trainingOverlapViolations: observations.filter(row => row.trainingCusips.split(";").includes(row.cusip)).length,
    duplicateObservations: observations.length - new Set(observations.map(row =>
        `${row.event}|${row.side}|${row.cutoff}|${row.adjustment}|${row.cusip}|${row.metric}`)).size,
};
assert.ok(completePairs > 0 && observations.length > 0);
assert.equal(verification.knownInflationViolations, 0);
assert.equal(verification.trainingOverlapViolations, 0);
assert.equal(verification.duplicateObservations, 0);
const report = [
    "# Matched release decomposition at a common future start", "",
    `Range: ${options.from} through ${options.through}; ${completePairs} complete release -5/+5 Treasury-session pairs of ${selected.length} selected pairs.`, "",
    "The two incomplete primary pairs retain their governing-episode exclusions; missing coverage is never filled with zero.",
    "Common start is each post-release maxREFCPI. Securities must be quoted on the same side at both dates and mature strictly after that start.",
    "Test buckets and 12/18/24-month training cutoffs are anchored once at pre-release settlement, with month-end-clamped calendar anniversaries. The same three nearest matched training bonds are used in every hybrid state.",
    "Before the release, CPI is actual only through that snapshot's known maxREFCPI. The unknown extension to common start grows at the pre-release six-month SA trend as NSA log growth (ACT/365), anchored at the old horizon.",
    "Post CPI is actual through common start. This is current-vintage replay, not a vintage-correct CPI forecast or consensus surprise. It does not use post CPI for the unknown pre-release extension.",
    "Seasonal factors are snapshot-capped lookups/projected month-day factors; full/decay forward ratios use the same common start at both snapshots.",
    "Financing is rederived from each snapshot's same-side T-bill quotes bracketing the common start, using the production log-discount interpolation and rate rounding. The old shorter-horizon pre-release repo rate is not extrapolated. Selected bill maturities/prices and both rates are saved.",
    "Price = common-start transformed clean price per 100. Yield = common-start coupon-equivalent yield in bp. These differ from the previous original-settlement residual basis.",
    "Signed residual = transformed market price/yield minus reference price/yield. Reference is a continuously compounded rate matching aggregate dirty prices of three matched longer bonds, equal par, allowing negative rates; no short test bond trains it.",
    "Eight hybrid states switch quote (bit 1), CPI path (bit 2), and context (bit 4: settlement date, repo rate, accrued/coupon ownership roll, and seasonal ratios). Indexed coupons and their repo carry are recomputed in every state.",
    "Shapley effects average all six update orders, splitting interactions symmetrically: residual change = quote + CPI + context - reference movement.",
    "Reference movement is itself decomposed using all eight refits. Net quote/CPI/context subtract each reference response; their sum equals residual change. These are algebraic attributions, not independent or causal shocks.",
    "A separate Shapley decomposition of squared residuals attributes fit improvement to quote, CPI, and context, each including reference recalibration. Positive fit contributions reduce squared residuals, and sum to pre-squared-error minus post-squared-error.",
    "A spot-quote change includes market carry accrual and all news in the window. Net CPI is conditional on the assumed pre-release projection, not a causal inflation effect.",
    "Training inputs retain publisher six-decimal rounding. The post hybrid corner must reproduce archived forward prices and adjustment ratios.",
    "Equal bonds within release/side, then equal available sides within releases, then equal releases. Bootstrap intervals use 2,000 fixed-seed paired release resamples; serial/repeated-security dependence and multiple testing are not modeled.",
    "Primary CPI state/gap is the release's announcement-to-horizon carry gap; the CPI path table separately reports projection error over the newly revealed segment.",
    "The CPI effect and regime labels share CPI inputs: strong directional slopes are partly mechanical, not independent validation of a natural curve. Reported CPI fit contributions depend on the pre-release trend-projection assumption.",
    "All data already informed the hypothesis. No independent prospective validation, causal CPI inference, or production switching rule is claimed.", "",
    "## Primary 6–12-month full-SA price decomposition", "",
    "Components are signed mean clean price per 100. Reference is minus the change in predicted common-start price. RMS residuals are episode-balanced, not realized returns.", "",
    "| Cutoff | State | Episodes | Pre RMSE | Post RMSE | Quote | CPI | Roll/repo/seasonal | Reference | Residual change | Net CPI [95%] |",
    "|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
];
const fmt = value => value.toFixed(5);
for (const row of summary.filter(row => row.scope === "primary" && row.bucket === "6-12m" && row.adjustment === "sa" && row.metric === "price")) {
    report.push(`| ${row.cutoff} | ${row.state} | ${row.events} | ${fmt(row.beforeRmse)} | ${fmt(row.afterRmse)} | ${fmt(row.quote)} | ${fmt(row.cpi)} | ${fmt(row.context)} | ${fmt(row.reference)} | ${fmt(row.signedChange)} | ${fmt(row.netCpi)} [${fmt(row.netCpiLower95)}, ${fmt(row.netCpiUpper95)}] |`);
}
report.push("", "## Primary full-SA fit improvement: 6–12 months", "",
    "All entries are squared clean price per 100. Quote/CPI/context include their reference responses and sum to total paired improvement. Intervals are exploratory episode-bootstrap intervals.", "",
    "| Cutoff | State | Total improvement [95%] | Quote contribution | CPI contribution [95%] | Context contribution |",
    "|---:|---|---|---:|---|---:|");
for (const row of summary.filter(row => row.scope === "primary" && row.bucket === "6-12m" && row.adjustment === "sa" && row.metric === "price")) {
    report.push(`| ${row.cutoff} | ${row.state} | ${fmt(row.squaredImprovement)} [${fmt(row.lower95)}, ${fmt(row.upper95)}] | ${fmt(row.fitQuoteImprovement)} | ${fmt(row.fitCpiImprovement)} [${fmt(row.fitCpiImprovementLower95)}, ${fmt(row.fitCpiImprovementUpper95)}] | ${fmt(row.fitContextImprovement)} |`);
}
report.push("", "## Verification", "", "```json", JSON.stringify(verification, null, 2), "```", "");
for (const [file, expected] of sources) assert.equal(hash(file), expected, `Input changed during release decomposition: ${file}`);
for (const [name, rows] of Object.entries({ observations, states: cubes, fits, financing, coverage, unmatched, paths, summary, relationships, influence })) {
    const fields = [...new Set(rows.flatMap(row => Object.keys(row)))];
    const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    fs.writeFileSync(path.join(options.output, `release-decomposition-${name}.csv`),
        `${fields.map(cell).join(",")}\n${rows.map(row => fields.map(field => cell(row[field])).join(",")).join("\n")}\n`);
}
fs.writeFileSync(path.join(options.output, "release-decomposition-input-hashes.json"),
    JSON.stringify([...sources].map(([file, sha256]) => ({ file, sha256 })), null, 2));
fs.writeFileSync(path.join(options.output, "release-decomposition-verification.json"), JSON.stringify(verification, null, 2));
fs.writeFileSync(path.join(options.output, "release-decomposition.md"), report.join("\n"));
console.log(JSON.stringify(verification, null, 2));
