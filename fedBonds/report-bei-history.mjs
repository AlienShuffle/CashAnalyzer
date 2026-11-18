// Publish fedBei-grid snapshots for fixed look-back periods, backfilling missing archive dates.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localDaily } from "./lib/daily-archive.mjs";
import { checkedDate, isTradingDay, shiftTrading, treasuryHolidays } from "./lib/research-calendar.mjs";

export const variants = ["ask", "bid"].flatMap(side =>
    ["", "sa-", "sa-decay-", "fwd-", "fwd-sa-", "fwd-sa-decay-"].map(qualifier => `${qualifier}${side}`));
const csvHeader = "period, targetDate, asOfDate, basis, nominalBasis, curveDate, term, date, tipsZeroCc, tipsZeroBey, nominalZeroCc, nominalZeroBey, beiCc, beiBey";
const fallbackDays = 3;

const shiftDays = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);

function yearAgo(date) {
    const [year, month, day] = date.split("-").map(Number);
    const last = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
    return new Date(Date.UTC(year - 1, month - 1, Math.min(day, last))).toISOString().slice(0, 10);
}

export function parseOptions(args) {
    const options = {
        date: null, backfill: true,
        published: path.join(os.homedir(), "cloudflare/public/Treasuries/fedBonds"),
        daily: localDaily,
        history: fileURLToPath(new URL("./history/", import.meta.url)),
    };
    for (const arg of args) {
        const [flag, value] = arg.split(/=(.*)/s);
        if (arg === "--no-backfill") options.backfill = false;
        else if (flag === "--date" && value) options.date = checkedDate(value);
        else if (flag === "--published" && value) options.published = path.resolve(value);
        else throw new Error(`Unknown option: ${arg}\nUsage: node fedBonds/report-bei-history.mjs [--date=YYYY-MM-DD] [--no-backfill] [--published=<dir>]`);
    }
    return options;
}

// Each period lists the trading dates to try, nearest first; non-trading calendar targets roll back.
export function historyPeriods(anchor) {
    checkedDate(anchor);
    const holidays = treasuryHolidays(Number(anchor.slice(0, 4)) - 2, Number(anchor.slice(0, 4)));
    const onOrBefore = date => isTradingDay(date, holidays) ? date : shiftTrading(date, -1, holidays);
    const candidates = first => Array.from({ length: fallbackDays + 1 }, (_, i) => shiftTrading(first, -i, holidays));
    const prior = shiftTrading(anchor, -1, holidays);
    return [
        { period: "current", targetDate: anchor, candidates: [anchor] },
        { period: "previousTradingDay", targetDate: prior, candidates: candidates(prior) },
        ...[30, 90, 180].map(days => {
            const targetDate = shiftDays(anchor, -days);
            return { period: `${days}d`, targetDate, candidates: candidates(onOrBefore(targetDate)) };
        }),
        { period: "1y", targetDate: yearAgo(anchor), candidates: candidates(onOrBefore(yearAgo(anchor))) },
    ];
}

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));

// Returns every variant's grid for an archived date, or null when any variant is absent.
export function loadArchivedGrids(daily, date) {
    if (!fs.existsSync(daily)) return null;
    const names = fs.readdirSync(daily).sort();
    const grids = {};
    for (const variant of variants) {
        const pattern = new RegExp(`^${date}(?:T\\d{4})?-fedBei-grid-${variant}\\.json$`);
        const name = names.filter(entry => pattern.test(entry)).at(-1);
        if (!name) return null;
        const grid = readJson(path.join(daily, name));
        if (grid.asOfDate?.slice(0, 10) !== date || !Array.isArray(grid.points)) {
            throw new Error(`Invalid archived BEI grid: ${path.join(daily, name)}`);
        }
        grids[variant] = grid;
    }
    return grids;
}

function loadCurrentGrids(history) {
    const grids = Object.fromEntries(variants.map(variant => {
        const file = path.join(history, `fedBei-grid-${variant}-rate-new.json`);
        if (!fs.existsSync(file)) throw new Error(`Missing current BEI grid: ${file}`);
        return [variant, readJson(file)];
    }));
    const dates = new Set(Object.values(grids).map(grid => grid.asOfDate));
    if (dates.size !== 1) throw new Error(`Current BEI grids have different asOfDates: ${[...dates].join(", ")}`);
    return grids;
}

export function buildBeiHistory({ date, history, daily, backfill, log = console.error }) {
    const current = date ? null : loadCurrentGrids(history);
    const anchor = date ?? current.ask.asOfDate;
    const periods = [], missing = [];
    for (const { period, targetDate, candidates } of historyPeriods(anchor)) {
        let grids = period === "current" ? current : null;
        const errors = [];
        for (const candidate of candidates) {
            if (grids) break;
            grids = loadArchivedGrids(daily, candidate);
            if (grids || !backfill) continue;
            try {
                backfill(candidate);
                grids = loadArchivedGrids(daily, candidate);
                if (!grids) throw new Error(`backfill did not archive every fedBei-grid variant`);
            } catch (error) {
                errors.push(`${candidate}: ${error.message.split("\n")[0]}`);
            }
        }
        if (grids) periods.push({ period, targetDate, grids });
        else {
            const error = errors.length ? errors.join("; ") : `not archived (${candidates.join(", ")})`;
            missing.push({ period, targetDate, error });
            log(`BEI history: ${period} (${targetDate}) unavailable: ${error}`);
        }
    }
    return Object.fromEntries(variants.map(variant => [variant, {
        asOfDate: anchor,
        periods: periods.map(({ period, targetDate, grids }) => ({ period, targetDate, ...grids[variant] })),
        missing,
    }]));
}

const csvValue = value => value === null || value === undefined ? ""
    : typeof value === "string" ? `"${value.replaceAll('"', '""')}"` : String(value);

export function historyCsv(report) {
    const rows = report.periods.flatMap(grid => grid.points.map(point => [
        grid.period, grid.targetDate, grid.asOfDate, grid.basis, grid.nominalBasis, grid.settleDate,
        point.term, point.date, point.tipsZeroCc, point.tipsZeroBey, point.nominalZeroCc, point.nominalZeroBey,
        point.beiCc, point.beiBey,
    ].map(csvValue).join(",")));
    return `${[csvHeader, ...rows].join("\n")}\n`;
}

function writeIfChanged(file, text) {
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
    const temp = `${file}.tmp.${process.pid}`;
    try {
        fs.writeFileSync(temp, text);
        fs.renameSync(temp, file);
    } finally {
        fs.rmSync(temp, { force: true });
    }
    return true;
}

export function publishBeiHistory(reports, published) {
    fs.mkdirSync(published, { recursive: true });
    for (const [variant, report] of Object.entries(reports)) {
        const name = `fedBei-history-${variant}`;
        const json = writeIfChanged(path.join(published, `${name}-rate.json`), `${JSON.stringify(report)}\n`);
        const csv = writeIfChanged(path.join(published, `${name}-rate.csv`), historyCsv(report));
        if (json || csv) console.log(`published updated ${name} cloudFlare rate files.`);
    }
    const manifest = fs.readdirSync(published).filter(name => /^fedBei-.*\.csv$/.test(name)).sort();
    writeIfChanged(path.join(published, "fedBei-manifest.txt"), `${manifest.join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const options = parseOptions(process.argv.slice(2));
        let backfill = false;
        if (options.backfill) {
            const { buildHistoricalReport } = await import("./report-history.mjs");
            backfill = date => {
                console.log(`BEI history: backfilling ${date}`);
                buildHistoricalReport({ date, input: null, fetch: false });
            };
        }
        const reports = buildBeiHistory({ ...options, backfill });
        publishBeiHistory(reports, options.published);
        const summary = reports.ask.periods.map(grid => `${grid.period}=${grid.asOfDate}`).join(", ");
        console.log(`BEI history as of ${reports.ask.asOfDate}: ${summary}`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
