// Seasonal-adjustment fit history: scans the archived mktTips-curve-* fits under daily/ and reports, for
// every snapshot, side and valuation date, how well the unadjusted (none), seasonally adjusted (sa) and
// credibility-decayed (sa-decay) TIPS curves fit, plus a summary of sa-decay against sa across history.
// Options: --daily=<archive dir> --shortYears=<years> --minDays=<n>
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { daysBetween, normalizeDate } from "./lib/dates.mjs";
import { roundTo } from "./lib/rounding.mjs";
import { svenssonZero } from "./lib/zero/index.mjs";

const SIDES = ["ask", "bid"];
const VALUATIONS = { settle: "", forward: "fwd-" };
const ADJUSTMENTS = { none: "", sa: "sa-", "sa-decay": "sa-decay-" };
const ZERO_TENORS = [1, 2];
const FILE_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{4})-mktTips-curve-(.+)\.json$/;

const bp = value => roundTo(value, 3);
const mean = values => values.reduce((s, v) => s + v, 0) / values.length;
const rms = values => (values.length ? Math.sqrt(mean(values.map(v => v * v))) : null);

function yearsTo(curveDate, maturity) {
    return daysBetween(normalizeDate(curveDate), normalizeDate(maturity)) / 365;
}

/**
 * Fit statistics of one archived TIPS curve.
 * monthRangeBp is the spread between the highest and lowest mean residual by maturity month among the
 * short bonds: the seasonal pattern left in the fit, which seasonal adjustment is meant to remove.
 */
export function curveFitStats(curve, { shortYears = 3 } = {}) {
    const rows = curve.rows.filter(row => Number.isFinite(row.residualBp));
    const short = rows.filter(row => yearsTo(curve.settleDate, row.maturity) <= shortYears);
    const long = rows.filter(row => yearsTo(curve.settleDate, row.maturity) > shortYears);
    const byMonth = new Map();
    for (const row of short) {
        const month = String(row.maturity).slice(5, 7);
        byMonth.set(month, [...(byMonth.get(month) ?? []), row.residualBp]);
    }
    const monthMeans = [...byMonth.values()].map(mean);
    return {
        bonds: rows.length,
        shortBonds: short.length,
        objective: roundTo(curve.objective, 6),
        rmsBp: bp(rms(rows.map(row => row.residualBp))),
        shortRmsBp: short.length ? bp(rms(short.map(row => row.residualBp))) : null,
        longRmsBp: long.length ? bp(rms(long.map(row => row.residualBp))) : null,
        maxAbsBp: bp(Math.max(...rows.map(row => Math.abs(row.residualBp)))),
        monthRangeBp: monthMeans.length > 1 ? bp(Math.max(...monthMeans) - Math.min(...monthMeans)) : null,
        ...Object.fromEntries(ZERO_TENORS.map(t => [`zero${t}y`, roundTo(svenssonZero(t, curve.params), 6)])),
    };
}

/** Reads the archive and groups curves by snapshot, side and valuation. */
export function loadArchivedCurves(dailyDir) {
    const curves = new Map();
    for (const file of fs.readdirSync(dailyDir).sort()) {
        const match = FILE_PATTERN.exec(file);
        if (!match) continue;
        const [, asOfDate, qualifiers] = match;
        for (const side of SIDES) {
            for (const [valuation, valuationPrefix] of Object.entries(VALUATIONS)) {
                for (const [adjustment, adjustmentPrefix] of Object.entries(ADJUSTMENTS)) {
                    if (qualifiers !== `${valuationPrefix}${adjustmentPrefix}${side}`) continue;
                    const key = `${asOfDate}|${side}|${valuation}`;
                    if (!curves.has(key)) curves.set(key, { asOfDate, side, valuation, fits: {} });
                    curves.get(key).fits[adjustment] = JSON.parse(fs.readFileSync(path.join(dailyDir, file), "utf-8"));
                }
            }
        }
    }
    return [...curves.values()];
}

function verdict(snapshots, days, decayWins, minDays) {
    if (days < minDays) return "insufficient history";
    if (decayWins >= snapshots * 2 / 3) return "sa-decay better";
    if (decayWins <= snapshots / 3) return "sa better";
    return "mixed";
}

/**
 * @param {Array<{asOfDate:string, side:string, valuation:string, fits:object}>} groups archived curves
 * @return {{rows: object[], summary: object[]}} per-snapshot statistics and the sa-decay vs sa summary
 */
export function buildFitHistory(groups, { shortYears = 3, minDays = 10 } = {}) {
    const rows = [];
    const pairs = [];
    for (const group of [...groups].sort((a, b) => (a.asOfDate + a.side + a.valuation < b.asOfDate + b.side + b.valuation ? -1 : 1))) {
        const stats = {};
        for (const adjustment of Object.keys(ADJUSTMENTS)) {
            const curve = group.fits[adjustment];
            if (!curve) continue;
            stats[adjustment] = curveFitStats(curve, { shortYears });
            rows.push({ asOfDate: group.asOfDate, side: group.side, valuation: group.valuation, adjustment, curveDate: curve.settleDate, ...stats[adjustment] });
        }
        if (stats.sa && stats["sa-decay"] && stats.sa.bonds === stats["sa-decay"].bonds) pairs.push({ ...group, sa: stats.sa, decay: stats["sa-decay"] });
    }

    const summary = [];
    for (const side of SIDES) {
        for (const valuation of Object.keys(VALUATIONS)) {
            const set = pairs.filter(pair => pair.side === side && pair.valuation === valuation);
            if (set.length === 0) continue;
            const delta = field => {
                const values = set.filter(p => p.sa[field] != null && p.decay[field] != null).map(p => p.decay[field] - p.sa[field]);
                return values.length ? bp(mean(values)) : null;
            };
            const decayWins = set.filter(p => p.decay.objective < p.sa.objective).length;
            const days = new Set(set.map(p => p.asOfDate.slice(0, 10))).size;
            summary.push({
                side,
                valuation,
                snapshots: set.length,
                days,
                firstAsOfDate: set[0].asOfDate,
                lastAsOfDate: set.at(-1).asOfDate,
                decayWins,
                decayWinShare: roundTo(decayWins / set.length, 3),
                objectiveChangePct: roundTo(mean(set.map(p => (p.decay.objective / p.sa.objective - 1) * 100)), 2),
                rmsDeltaBp: delta("rmsBp"),
                shortRmsDeltaBp: delta("shortRmsBp"),
                longRmsDeltaBp: delta("longRmsBp"),
                maxAbsDeltaBp: delta("maxAbsBp"),
                monthRangeDeltaBp: delta("monthRangeBp"),
                ...Object.fromEntries(ZERO_TENORS.map(t => [
                    `zero${t}yMeanAbsDiffBp`, bp(mean(set.map(p => Math.abs(p.decay[`zero${t}y`] - p.sa[`zero${t}y`]) * 10000))),
                ])),
                verdict: verdict(set.length, days, decayWins, minDays),
            });
        }
    }
    return { shortYears, minDays, rows, summary };
}

export function parseOptions(args) {
    const options = { daily: null, shortYears: 3, minDays: 10 };
    for (const arg of args) {
        const match = /^--(daily|shortYears|minDays)=(.+)$/.exec(arg);
        if (!match) throw new Error(`Unknown option: ${arg}`);
        options[match[1]] = match[1] === "daily" ? match[2] : Number(match[2]);
    }
    if (!options.daily) throw new Error("--daily is required");
    if (!(options.shortYears > 0)) throw new Error("shortYears must be positive");
    if (!(Number.isInteger(options.minDays) && options.minDays > 0)) throw new Error("minDays must be a positive integer");
    return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const options = parseOptions(process.argv.slice(2));
    const groups = loadArchivedCurves(options.daily);
    if (groups.length === 0) throw new Error(`No archived mktTips-curve fits in ${options.daily}`);
    console.log(JSON.stringify(buildFitHistory(groups, options)));
}
