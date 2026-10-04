// Reference CPI and seasonal-factor lookups. Ported from tips.utils.gs / areokam.RefCpi.gs.
// The Apps Script version read a cached, fetched table; here the lookups are built over rows
// supplied by the caller so the math stays free of I/O. Use loadRefCpiTable() to fetch them.
import { dateEquals, normalizeDate } from "../dates.mjs";

export const REFCPI_URL = "https://pub-ba11062b177640459f72e0a88d0261ae.r2.dev/TIPS/RefCpiNsaSa.csv";

const mmdd = d => (d.getMonth() + 1) * 100 + d.getDate();

/**
 * Parse RefCpiNsaSa.csv text ("Ref CPI Date,Ref CPI NSA,Ref CPI SA,SA Factor").
 * @param {string} text
 * @param {{oldestDate?: Date|string}} [options] drop rows before this date
 * @return {Array<{date:Date, refCpiNSA:number, refCpiSa:number, saFactor:number}>} newest first
 */
export function parseRefCpiCsv(text, { oldestDate } = {}) {
    if (!text || text.includes("<html>")) throw new Error("REFCPI data is empty or not CSV");
    const oldest = normalizeDate(oldestDate);
    const rows = [];
    for (const line of text.split("\n").slice(1)) {
        const vals = line.trim().split(",");
        if (vals.length < 4 || !/^\d{4}-\d{2}-\d{2}$/.test(vals[0])) continue;
        const date = normalizeDate(vals[0]);
        if (oldest && date < oldest) continue;
        rows.push({
            date,
            refCpiNSA: Number(vals[1]),
            refCpiSa: Number(vals[2]),
            saFactor: Number(vals[3]),
        });
    }
    return rows.sort((a, b) => b.date - a.date);
}

/**
 * Fetch and parse the REFCPI table, returning lookups (see createRefCpiTable).
 * @param {{url?: string, oldestDate?: Date|string}} [options]
 */
export async function loadRefCpiTable({ url = REFCPI_URL, oldestDate } = {}) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`REFCPI request failed: ${response.status} ${url}`);
    return createRefCpiTable(parseRefCpiCsv(await response.text(), { oldestDate }));
}

/**
 * Build lookups over REFCPI rows.
 * @param {Array<{date:Date|string, refCpiNSA:number, saFactor:number}>} rows
 * @return {{rows:Array, getFactor:(d:Date|string)=>number|null, getRefCpi:(d:Date|string)=>number|null, maxDate:Date}}
 */
export function createRefCpiTable(rows) {
    const sorted = rows
        .map(r => ({ ...r, date: normalizeDate(r.date) }))
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
