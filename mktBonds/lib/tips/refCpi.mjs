// Reference CPI and seasonal-factor lookups. Ported from tips.utils.gs / areokam.RefCpi.gs.
// The Apps Script version read a cached, fetched table; here the lookups are built over rows
// supplied by the caller so the math stays free of I/O. Use loadRefCpiTable() to fetch them.
import { dateEquals, normalizeDate } from "../dates.mjs";

export const REFCPI_URL = "https://cashoptimizer.pages.dev/Treasuries/REFCPI.csv";

const mmdd = d => (d.getMonth() + 1) * 100 + d.getDate();

/**
 * Parse the project REFCPI.csv, or the original four-column RefCpiNsaSa.csv.
 * @param {string} text
 * @param {{oldestDate?: Date|string, asOfDate?: Date|string}} [options]
 * @return {Array<{date:Date, refCpiNSA:number, refCpiSa:number, saFactor:number, maxRefCpi?:Date}>} newest first
 */
export function parseRefCpiCsv(text, { oldestDate, asOfDate } = {}) {
    if (!text || text.includes("<html>")) throw new Error("REFCPI data is empty or not CSV");
    const oldest = checkedDate(oldestDate, "oldestDate");
    const lines = text.trim().split("\n");
    const header = lines[0].split(",").map(value => value.trim());
    const horizonIndex = header.indexOf("maxREFCPI");
    const rows = [];
    for (const line of lines.slice(1)) {
        const vals = line.trim().split(",");
        if (vals.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(vals[0])) continue;
        const date = normalizeDate(vals[0]);
        const maxRefCpi = horizonIndex < 0 ? undefined : checkedDate(vals[horizonIndex], "maxREFCPI");
        if (horizonIndex >= 0 && !maxRefCpi) throw new Error(`Missing maxREFCPI for ${vals[0]}`);
        rows.push({
            date,
            refCpiNSA: Number(vals[1]),
            refCpiSa: Number(vals[2]),
            saFactor: Number(vals[3]),
            ...(maxRefCpi && { maxRefCpi }),
        });
    }
    return limitAsOf(rows, asOfDate).filter(row => !oldest || row.date >= oldest).sort((a, b) => b.date - a.date);
}

function checkedDate(value, name) {
    if (value === undefined || value === null) return null;
    const input = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
    const date = normalizeDate(input);
    if (!date || !Number.isFinite(date.getTime())) throw new Error(`Invalid ${name}: ${value}`);
    if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const [year, month, day] = input.split("-").map(Number);
        if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) {
            throw new Error(`Invalid ${name}: ${value}`);
        }
    }
    return date;
}

function limitAsOf(rows, asOfDate) {
    const asOf = checkedDate(asOfDate, "asOfDate");
    if (!asOf) return rows;
    const mapping = rows.filter(row => row.date <= asOf).sort((a, b) => b.date - a.date)[0];
    if (!mapping) throw new Error(`REFCPI has no historical horizon for asOfDate ${asOfDate}`);
    const horizon = checkedDate(mapping.maxRefCpi, "maxREFCPI");
    if (!horizon) throw new Error("Historical REFCPI analysis requires a maxREFCPI column");
    return rows.filter(row => row.date <= horizon);
}

/**
 * Fetch and parse the REFCPI table, returning lookups (see createRefCpiTable).
 * @param {{url?: string, oldestDate?: Date|string, asOfDate?: Date|string}} [options]
 */
export async function loadRefCpiTable({ url = REFCPI_URL, oldestDate, asOfDate } = {}) {
    checkedDate(asOfDate, "asOfDate");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`REFCPI request failed: ${response.status} ${url}`);
    return createRefCpiTable(parseRefCpiCsv(await response.text(), { oldestDate, asOfDate }));
}

/**
 * Build lookups over REFCPI rows.
 * @param {Array<{date:Date|string, refCpiNSA:number, saFactor:number, maxRefCpi?:Date|string}>} rows
 * @param {{asOfDate?:Date|string}} [options] cap rows at the historical maxREFCPI horizon
 * @return {{rows:Array, getFactor:(d:Date|string)=>number|null, getRefCpi:(d:Date|string)=>number|null, maxDate:Date}}
 */
export function createRefCpiTable(rows, { asOfDate } = {}) {
    const sorted = limitAsOf(rows.map(r => ({ ...r, date: normalizeDate(r.date) })), asOfDate)
        .sort((a, b) => b.date - a.date);
    if (sorted.length === 0) throw new Error("REFCPI table has no rows");

    // Exact day when published, else the most recent row with the same month/day
    // (a projection for future dates). Null if neither exists.
    function getFactor(searchDate) {
        const date = normalizeDate(searchDate);
        if (!date) return null;
        const exact = sorted.find(r => dateEquals(r.date, date));
        if (exact) return exact.saFactor;
        const key = mmdd(date);
        const sameDay = sorted.find(r => mmdd(r.date) === key);
        return sameDay ? sameDay.saFactor : null;
    }

    // Published NSA reference CPI for a date, or null when it is not in the table.
    function getRefCpi(searchDate) {
        const date = normalizeDate(searchDate);
        const exact = date && sorted.find(r => dateEquals(r.date, date));
        return exact ? exact.refCpiNSA : null;
    }

    return { rows: sorted, getFactor, getRefCpi, maxDate: sorted[0].date };
}
