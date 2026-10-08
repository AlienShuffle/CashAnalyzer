// BEI stability: settle against forward. For the seasonally adjusted TIPS fits (sa, sa-decay) of each
// archived snapshot, reports constant-maturity BEI (nominal minus TIPS zero, continuously compounded) at
// short tenors, how far dropping any one short TIPS moves it (leave-one-out), how well the short bonds
// fit, and the settle BEI with the known (REFCPI) inflation to the forward date removed. Across days,
// it reports how much each BEI series moves, and summarises settle against forward.
// Options: --daily=<archive dir> --cache=<leave-one-out cache file> --shortYears=<years> --minDays=<n>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { daysBetween, normalizeDate } from "./lib/dates.mjs";
import { roundTo } from "./lib/rounding.mjs";
import { fitTipsSvensson, svenssonZero } from "./lib/zero/index.mjs";

export const TENORS = [0.5, 1, 2, 5];
const SIDES = ["ask", "bid"];
const ADJUSTMENTS = ["sa", "sa-decay"];
const VALUATIONS = ["settle", "forward"];
const SNAPSHOT_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{4})-mktTips-curve-/;
// Relative difference below which settle and forward are called similar.
const SIMILAR = 0.1;

const bp = value => (value == null ? null : roundTo(value * 10000, 3));
const mean = values => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
const rms = values => (values.length ? Math.sqrt(mean(values.map(v => v * v))) : null);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const tenorKey = tenor => String(tenor).replace(".", "_");

function yearsBetween(from, to) {
    return daysBetween(normalizeDate(from), normalizeDate(to)) / 365;
}

function curveName(adjustment, valuation, side) {
    return `mktTips-curve-${valuation === "forward" ? "fwd-" : ""}${adjustment}-${side}`;
}

function nominalName(valuation, side) {
    return `mktNominal-grid-${valuation === "forward" ? "fwd-" : ""}${side}`;
}

/**
 * Known inflation from settlement to the forward date as a log index ratio, seasonally adjusted the same
 * way as the sa fits: ln(fwd REFCPI / settle REFCPI) + ln(settle seasonal factor / forward seasonal
 * factor). The factor ratio is settle_mature_sa_ratio / fwd_mature_sa_ratio, which does not depend on
 * maturity; sa-decay fits use the same value, which ignores the small decay difference.
 */
export function knownInflation(tipsRows) {
    const [first] = tipsRows;
    const ratios = tipsRows
        .map(row => Number(row.settle_mature_sa_ratio) / Number(row.fwd_mature_sa_ratio))
        .filter(Number.isFinite);
    if (!first || !(first.settle_refcpi > 0) || !(first.fwd_refcpi > 0) || ratios.length === 0) return null;
    return Math.log(first.fwd_refcpi / first.settle_refcpi) + Math.log(median(ratios));
}

/**
 * Largest move of the TIPS zero at each tenor when each short bond in turn is left out of the fit.
 * impliedMaxBp is the move in the implied forward BEI: for a settle curve (gapYears > 0) the zero at
 * gapYears + tenor scaled by (gapYears + tenor) / tenor; for a forward curve it equals maxBp.
 */
export function leaveOneOut(curve, { shortYears = 3, gapYears = 0 } = {}) {
    const bonds = curve.rows.map(row => ({ cusip: row.cusip, maturity: row.maturity, coupon: row.coupon, cleanPrice: row.marketClean }));
    const result = Object.fromEntries(TENORS.map(t => [tenorKey(t), { maxBp: 0, impliedMaxBp: 0, cusip: null }]));
    for (const [index, bond] of bonds.entries()) {
        if (yearsBetween(curve.settleDate, bond.maturity) > shortYears) continue;
        const { params } = fitTipsSvensson(curve.settleDate, bonds.filter((_, i) => i !== index));
        for (const tenor of TENORS) {
            const shift = Math.abs(svenssonZero(tenor, params) - svenssonZero(tenor, curve.params)) * 10000;
            const span = gapYears + tenor;
            const impliedShift = Math.abs(svenssonZero(span, params) - svenssonZero(span, curve.params)) * 10000 * span / tenor;
            const entry = result[tenorKey(tenor)];
            if (shift > entry.maxBp) Object.assign(entry, { maxBp: roundTo(shift, 3), cusip: bond.cusip });
            entry.impliedMaxBp = Math.max(entry.impliedMaxBp, roundTo(impliedShift, 3));
        }
    }
    return result;
}

function shortFit(curve, shortYears) {
    const short = curve.rows.filter(row => yearsBetween(curve.settleDate, row.maturity) <= shortYears);
    return {
        bonds: curve.rows.length,
        shortBonds: short.length,
        shortRmsBp: short.length ? roundTo(rms(short.map(row => row.residualBp)), 3) : null,
        shortPriceRms: short.length ? roundTo(rms(short.map(row => row.priceResidual)), 6) : null,
    };
}

/**
 * Last snapshot of each calendar date that has every input for a side, read from the archive.
 * @return {Array<{asOfDate:string, side:string, tipsRows:object[], curves:object, nominals:object}>}
 */
export function loadSnapshots(dailyDir) {
    const files = new Set(fs.readdirSync(dailyDir));
    const asOfDates = [...new Set([...files].map(file => SNAPSHOT_PATTERN.exec(file)?.[1]).filter(Boolean))].sort();
    const read = name => JSON.parse(fs.readFileSync(path.join(dailyDir, name), "utf-8"));
    const latestByDay = new Map();
    for (const side of SIDES) {
        for (const asOfDate of asOfDates) {
            const needed = [
                `mktTips-${side}`,
                ...VALUATIONS.map(v => nominalName(v, side)),
                ...ADJUSTMENTS.flatMap(a => VALUATIONS.map(v => curveName(a, v, side))),
            ];
            if (!needed.every(name => files.has(`${asOfDate}-${name}.json`))) continue;
            latestByDay.set(`${side}|${asOfDate.slice(0, 10)}`, { asOfDate, side });
        }
    }
    return [...latestByDay.values()].map(({ asOfDate, side }) => ({
        asOfDate,
        side,
        tipsRows: read(`${asOfDate}-mktTips-${side}.json`),
        nominals: Object.fromEntries(VALUATIONS.map(v => [v, read(`${asOfDate}-${nominalName(v, side)}.json`)])),
        curves: Object.fromEntries(ADJUSTMENTS.map(a => [a, Object.fromEntries(VALUATIONS.map(v => [v, read(`${asOfDate}-${curveName(a, v, side)}.json`)]))])),
    }));
}

/**
 * @param {object[]} snapshots from loadSnapshots
 * @param {{shortYears?:number, minDays?:number, cache?:object}} options cache maps
 *   "asOfDate|side|adjustment|valuation" to leaveOneOut results; it is read and filled in
 * @return {{rows:object[], summary:object[]}}
 */
export function buildBeiStability(snapshots, { shortYears = 3, minDays = 10, cache = {} } = {}) {
    const rows = [];
    for (const snapshot of [...snapshots].sort((a, b) => (a.asOfDate + a.side < b.asOfDate + b.side ? -1 : 1))) {
        const known = knownInflation(snapshot.tipsRows);
        for (const adjustment of ADJUSTMENTS) {
            const settleCurve = snapshot.curves[adjustment].settle;
            const forwardCurve = snapshot.curves[adjustment].forward;
            const settleDate = settleCurve.settleDate;
            const forwardDate = forwardCurve.settleDate;
            if (normalizeDate(snapshot.nominals.settle.settleDate) - normalizeDate(settleDate) !== 0
                || normalizeDate(snapshot.nominals.forward.settleDate) - normalizeDate(forwardDate) !== 0) {
                throw new Error(`${snapshot.asOfDate} ${snapshot.side}: nominal and TIPS curve dates differ`);
            }
            const gapYears = yearsBetween(settleDate, forwardDate);
            for (const valuation of VALUATIONS) {
                const curve = snapshot.curves[adjustment][valuation];
                const nominal = snapshot.nominals[valuation];
                const key = `${snapshot.asOfDate}|${snapshot.side}|${adjustment}|${valuation}`;
                cache[key] ??= leaveOneOut(curve, { shortYears, gapYears: valuation === "settle" ? gapYears : 0 });
                const row = {
                    asOfDate: snapshot.asOfDate, side: snapshot.side, adjustment, valuation,
                    curveDate: curve.settleDate, forwardDate, ...shortFit(curve, shortYears),
                    knownInflation: valuation === "settle" && known != null ? roundTo(known, 6) : null,
                };
                for (const tenor of TENORS) {
                    const k = tenorKey(tenor);
                    const nominalZero = svenssonZero(tenor, nominal.params);
                    row[`nominal${k}y`] = roundTo(nominalZero, 6);
                    row[`bei${k}y`] = roundTo(nominalZero - svenssonZero(tenor, curve.params), 6);
                    row[`loo${k}yBp`] = cache[key][k].maxBp;
                    row[`loo${k}yCusip`] = cache[key][k].cusip;
                    row[`looImplied${k}yBp`] = cache[key][k].impliedMaxBp;
                    // Settle BEI over [settle, forward + tenor] less the known part over [settle, forward].
                    if (valuation === "settle") {
                        const span = gapYears + tenor;
                        const settleBei = svenssonZero(span, nominal.params) - svenssonZero(span, curve.params);
                        row[`implied${k}y`] = known == null ? null : roundTo((settleBei * span - known) / tenor, 6);
                    } else {
                        row[`implied${k}y`] = null;
                    }
                }
                rows.push(row);
            }
        }
    }
    return { shortYears, minDays, tenors: TENORS, rows, summary: summarize(rows, minDays) };
}

function changes(series, field) {
    const values = [];
    for (let i = 1; i < series.length; i++) {
        if (series[i].forwardDate !== series[i - 1].forwardDate) continue;
        const [a, b] = [series[i - 1][field], series[i][field]];
        if (a != null && b != null) values.push(b - a);
    }
    return values;
}

function compare(settle, forward) {
    if (settle == null || forward == null) return null;
    if (Math.abs(forward - settle) <= SIMILAR * Math.max(Math.abs(settle), Math.abs(forward))) return "similar";
    return forward < settle ? "forward" : "settle";
}

function summarize(rows, minDays) {
    const summary = [];
    for (const side of SIDES) {
        for (const adjustment of ADJUSTMENTS) {
            const pick = valuation => rows.filter(r => r.side === side && r.adjustment === adjustment && r.valuation === valuation);
            const settle = pick("settle");
            const forward = pick("forward");
            if (settle.length === 0 || forward.length === 0) continue;
            const forwardByAsOf = new Map(forward.map(r => [r.asOfDate, r]));
            const fit = (set, field) => roundTo(mean(set.map(r => r[field]).filter(v => v != null)) ?? NaN, 6);
            for (const tenor of TENORS) {
                const k = tenorKey(tenor);
                const settleChanges = changes(settle, `bei${k}y`);
                const forwardChanges = changes(forward, `bei${k}y`);
                const impliedChanges = changes(settle, `implied${k}y`);
                const gaps = settle
                    .filter(r => r[`implied${k}y`] != null && forwardByAsOf.has(r.asOfDate))
                    .map(r => r[`implied${k}y`] - forwardByAsOf.get(r.asOfDate)[`bei${k}y`]);
                const settleChangeBp = bp(rms(settleChanges));
                const impliedChangeBp = bp(rms(impliedChanges));
                const forwardChangeBp = bp(rms(forwardChanges));
                const settleLooBp = roundTo(mean(settle.map(r => r[`loo${k}yBp`])), 3);
                const impliedLooBp = roundTo(mean(settle.map(r => r[`looImplied${k}yBp`])), 3);
                const forwardLooBp = roundTo(mean(forward.map(r => r[`loo${k}yBp`])), 3);
                const settleShortPriceRms = fit(settle, "shortPriceRms");
                const forwardShortPriceRms = fit(forward, "shortPriceRms");
                const enough = settle.length >= minDays;
                summary.push({
                    side, adjustment, tenor,
                    days: settle.length,
                    changes: settleChanges.length,
                    firstAsOfDate: settle[0].asOfDate,
                    lastAsOfDate: settle.at(-1).asOfDate,
                    settleBei: roundTo(mean(settle.map(r => r[`bei${k}y`])), 6),
                    impliedBei: roundTo(mean(settle.map(r => r[`implied${k}y`]).filter(v => v != null)) ?? NaN, 6),
                    forwardBei: roundTo(mean(forward.map(r => r[`bei${k}y`])), 6),
                    impliedGapBp: bp(mean(gaps.map(Math.abs))),
                    settleChangeBp,
                    impliedChangeBp,
                    forwardChangeBp,
                    settleNominalChangeBp: bp(rms(changes(settle, `nominal${k}y`))),
                    forwardNominalChangeBp: bp(rms(changes(forward, `nominal${k}y`))),
                    settleLooBp,
                    impliedLooBp,
                    forwardLooBp,
                    settleShortRmsBp: fit(settle, "shortRmsBp"),
                    forwardShortRmsBp: fit(forward, "shortRmsBp"),
                    settleShortPriceRms,
                    forwardShortPriceRms,
                    // Verdicts compare forward with the settle-implied forward BEI (the same quantity);
                    // raw settle BEI is diluted by the known inflation and is not a like-for-like comparison.
                    stabler: enough && impliedChanges.length > 0 && forwardChanges.length > 0 ? compare(impliedChangeBp, forwardChangeBp) : "insufficient history",
                    robuster: compare(impliedLooBp, forwardLooBp),
                    fitter: compare(settleShortPriceRms, forwardShortPriceRms),
                });
            }
        }
    }
    return summary;
}

export function parseOptions(args) {
    const options = { daily: null, cache: null, shortYears: 3, minDays: 10 };
    for (const arg of args) {
        const match = /^--(daily|cache|shortYears|minDays)=(.+)$/.exec(arg);
        if (!match) throw new Error(`Unknown option: ${arg}`);
        options[match[1]] = ["daily", "cache"].includes(match[1]) ? match[2] : Number(match[2]);
    }
    if (!options.daily) throw new Error("--daily is required");
    if (!(options.shortYears > 0)) throw new Error("shortYears must be positive");
    if (!(Number.isInteger(options.minDays) && options.minDays > 1)) throw new Error("minDays must be an integer above 1");
    return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const options = parseOptions(process.argv.slice(2));
    const snapshots = loadSnapshots(options.daily);
    if (snapshots.length === 0) throw new Error(`No complete archived snapshots in ${options.daily}`);
    const saved = options.cache && fs.existsSync(options.cache) ? JSON.parse(fs.readFileSync(options.cache, "utf-8")) : {};
    const cacheKey = `shortYears=${options.shortYears};v2`;
    const cache = saved.key === cacheKey ? saved.entries : {};
    const result = buildBeiStability(snapshots, { ...options, cache });
    if (options.cache) {
        const used = new Set(result.rows.map(r => `${r.asOfDate}|${r.side}|${r.adjustment}|${r.valuation}`));
        const entries = Object.fromEntries(Object.entries(cache).filter(([key]) => used.has(key)));
        fs.writeFileSync(options.cache, JSON.stringify({ key: cacheKey, entries }));
    }
    console.log(JSON.stringify(result));
}
