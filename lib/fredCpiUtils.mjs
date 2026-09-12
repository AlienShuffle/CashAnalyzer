// Shared FRED CPI series fetcher, reused by REFCPI and SAFACTOR so both pull
// directly from the primary source instead of an intermediate mirror.
import {
    duDateLessThan,
    duGetDateFromYYYYMMDD
} from "./dateUtils.mjs";

// FRED never published these months for the affected series (2025 government shutdown).
// Recorded once here so both REFCPI and SAFACTOR see the same gap-fill value; update here only.
const KNOWN_CPI_GAP_FILLS = {
    CPIAUCSL: [{ fullDate: "2025-10-01", value: 325.551 }],
    CPIAUCNS: [{ fullDate: "2025-10-01", value: 325.604 }],
};

/**
 * Fetch a monthly CPI series directly from FRED.
 * @param {string} series FRED series id, e.g. CPIAUCSL (SA) or CPIAUCNS (NSA).
 * @param {object} [options]
 * @param {string} [options.attr] json attribute name to use for the CPI value in the returned rows. Defaults to "CPI".
 * @param {string} [options.startDateString] earliest date to include, in YYYY-MM-DD form. Defaults to "1996-01-01".
 * @returns {Promise<Array<{fullDate: string, year: number, month: number}>>}
 */
export async function fetchFredCpiMonths(series, { attr = "CPI", startDateString = "1996-01-01" } = {}) {
    const startDate = duGetDateFromYYYYMMDD(startDateString);
    const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${startDateString}&coed=9999-12-31`);
    const text = await response.text();
    const rows = text.split("\n");
    const filtered = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split(",");
        if (row.length < 2) continue;

        const month = duGetDateFromYYYYMMDD(row[0]);
        if (duDateLessThan(month, startDate)) continue;

        const CPI = row[1] * 1;
        if (isNaN(CPI) || CPI === 0) continue;

        filtered.push({
            fullDate: row[0],
            year: month.getFullYear(),
            month: month.getMonth() + 1,
            [attr]: CPI,
        });
    }

    for (const gapFill of KNOWN_CPI_GAP_FILLS[series] ?? []) {
        if (duDateLessThan(duGetDateFromYYYYMMDD(gapFill.fullDate), startDate)) continue;
        if (filtered.some(r => r.fullDate === gapFill.fullDate)) continue;

        const gapMonth = duGetDateFromYYYYMMDD(gapFill.fullDate);
        filtered.push({
            fullDate: gapFill.fullDate,
            year: gapMonth.getFullYear(),
            month: gapMonth.getMonth() + 1,
            [attr]: gapFill.value,
        });
    }
    filtered.sort((a, b) => duGetDateFromYYYYMMDD(a.fullDate) - duGetDateFromYYYYMMDD(b.fullDate));

    if (filtered.length <= 50) {
        console.error(`Error: ${series}, Not enough data points retrieved. probaby intermittent issue.`);
        process.exit(1);
    }

    return filtered;
}
