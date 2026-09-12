import {
    duDateLessThan,
    duGetDateFromYYYYMMDD
} from "../lib/dateUtils.mjs";
import {
    roundToFixed
} from "../lib/utils.mjs";

export async function getCPIMonths(metric) {
    const startDate = new Date(1996, 0, 1);
    const response = await fetch(`https://cashoptimizer.pages.dev/Treasuries/${metric}.csv`);
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
            CPI,
        });
    }

    if (filtered.length <= 50) {
        console.error(`Error: ${metric}, Not enough data points retrieved. probaby intermittent issue.`);
        process.exit(1);
    }

    return filtered;
}

export function buildBlsNsSaFactors(slMonths, nsMonths) {
    let blsNsSaFactors = [];
    let lastFullYear = null;

    for (let i = 0; i < slMonths.length; i++) {
        const year = slMonths[i].year;
        const month = slMonths[i].month;
        const slCPI = slMonths[i].CPI;
        const nsCPI = getNSCPI(year, month, nsMonths);

        if (nsCPI === null) {
            console.error(`Error: ${year}-${month}, No matching NS CPI value found.`);
            process.exit(1);
        }

        if (year > lastFullYear && month === 12) {
            lastFullYear = year;
        }

        const factor = nsCPI / slCPI;

        blsNsSaFactors.push({
            fullDate: slMonths[i].fullDate,
            year,
            month,
            CPINS: nsCPI,
            CPISL: slCPI,
            factor,
        });
    }

    return { blsFactors: blsNsSaFactors, lastFullYear };
}

function getNSCPI(year, month, nsMonths) {
    for (let i = nsMonths.length - 1; i >= 0; i--) {
        if (nsMonths[i].year === year && nsMonths[i].month === month) {
            return nsMonths[i].CPI;
        }
    }
    return null;
}

export function getMonthsInWindow(months, startDate, endDate) {
    const start = duGetDateFromYYYYMMDD(startDate);
    const end = duGetDateFromYYYYMMDD(endDate);

    return months.filter((r) => {
        const rowDate = duGetDateFromYYYYMMDD(r.fullDate);
        return !duDateLessThan(rowDate, start) && !duDateLessThan(end, rowDate);
    });
}

export function getTipsAdjustedMonth(month) {
    return ((month + 3 - 1) % 12) + 1;
}

export function calculateBlsFactorAverages(months, trimOutliers = false) {
    const factorGroups = [];
    for (const r of months) {
        const adjustedMonth = getTipsAdjustedMonth(r.month);
        if (!factorGroups[adjustedMonth]) factorGroups[adjustedMonth] = [];
        factorGroups[adjustedMonth].push(r);
    }

    const historicalFactors = [];
    for (let month = 1; month <= 12; month++) {
        const entries = factorGroups[month];
        if (!entries || entries.length === 0) continue;

        const factors = entries
            .map(r => r.factor)
            .sort((a, b) => a - b);
        if (trimOutliers && factors.length > 2) {
            factors.shift();
            factors.pop();
        }

        const average = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
        const calcStart = entries.reduce((min, r) => r.fullDate < min ? r.fullDate : min, entries[0].fullDate);
        const calcEnd = entries.reduce((max, r) => r.fullDate > max ? r.fullDate : max, entries[0].fullDate);

        historicalFactors.push({
            factor: average,
            month,
            calcStart,
            calcEnd,
            entriesTested: factors.length,
        });
    }

    if (trimOutliers) {
        const totalFactor = historicalFactors.reduce((sum, r) => sum + r.factor, 0);
        const adjustmentRatio = 12 / totalFactor;
        for (const historicalFactor of historicalFactors) {
            historicalFactor.factor = historicalFactor.factor * adjustmentRatio;
        }
    }

    return historicalFactors;
}

export function buildBlsNsChapsalisSeasonalFactors(months) {
    if (!Array.isArray(months) || months.length < 2) {
        console.error("Error: buildBlsNsChapsalisSeasonalFactors requires at least 2 months of CPINS history.");
        return null;
    }

    const sortedMonths = [...months].sort((a, b) =>
        duGetDateFromYYYYMMDD(a.fullDate) - duGetDateFromYYYYMMDD(b.fullDate));

    const monthValues = Array.from({ length: 12 }, () => []);

    for (let i = 1; i < sortedMonths.length; i++) {
        const prevMonth = sortedMonths[i - 1];
        const currMonth = sortedMonths[i];

        if (!Number.isFinite(prevMonth.CPINS) || !Number.isFinite(currMonth.CPINS) || prevMonth.CPINS <= 0 || currMonth.CPINS <= 0) {
            continue;
        }

        const monthIndex = duGetDateFromYYYYMMDD(currMonth.fullDate).getMonth();
        const actualGrowth = currMonth.CPINS / prevMonth.CPINS - 1;

        monthValues[monthIndex].push(actualGrowth);
    }

    const factors = monthValues.map((values, index) => {
        if (values.length === 0) {
            console.error(`Warning: no Chapsalis growth rates available for month ${index + 1}; skipping that month.`);
            return null;
        }

        const actualAverageGrowth = values.reduce((sum, value) => sum + value, 0) / values.length;

        const totalGrowth = sortedMonths[sortedMonths.length - 1].CPINS / sortedMonths[0].CPINS - 1;
        const monthlyTrendGrowth = Math.pow(1 + totalGrowth, 1 / 12) - 1;

        return 1 + (monthlyTrendGrowth - actualAverageGrowth);
    });

    const validFactors = factors.filter(value => Number.isFinite(value));
    if (validFactors.length === 0) {
        console.error("Error: buildBlsNsChapsalisSeasonalFactors produced no valid factors.");
        return null;
    }

    const avg = validFactors.reduce((sum, value) => sum + value, 0) / validFactors.length;
    const normalized = factors.map(f => f === null ? null : f / avg);

    return normalized;
}

export function buildBlsNsChapsalisFactorRows(months) {
    if (!Array.isArray(months) || months.length < 2) {
        console.error("Error: buildBlsNsChapsalisFactorRows requires at least 2 months of CPINS history.");
        return null;
    }

    const seasonalFactors = buildBlsNsChapsalisSeasonalFactors(months);
    if (!seasonalFactors) {
        console.error("Error: buildBlsNsChapsalisFactorRows could not build valid BLS NS Chapsalis factors from the CPINS history.");
        return null;
    }

    const sortedMonths = [...months].sort((a, b) =>
        duGetDateFromYYYYMMDD(a.fullDate) - duGetDateFromYYYYMMDD(b.fullDate));

    const calcStart = sortedMonths[0].fullDate;
    const calcEnd = sortedMonths[sortedMonths.length - 1].fullDate;

    const factors = seasonalFactors.map((seasonalFactor, index) => {
        if (!Number.isFinite(seasonalFactor)) {
            return null;
        }

        return {
            month: index + 1,
            factor: seasonalFactor,
            calcStart,
            calcEnd,
            entriesTested: sortedMonths.length,
        };
    }).filter(Boolean);

    if (factors.length === 0) {
        console.error("Error: buildBlsNsChapsalisFactorRows produced no valid factors.");
        return null;
    }

    return factors;
}

// This helper assumes historicalFactors are already sorted by month and have a factor property.
// Callers must provide 13 consecutive source-month rows: 12 output months plus the following
// source month used to close out the 12th month's dailyDelta. The output month is the source
// month shifted forward three months for the TIPS delay, so source July is output month 10.
// For example, a July 2025 through July 2026 input calculates July 2025's delta from August
// 2025 and June 2026's delta from July 2026.
export function finalizeFactorHistory(historicalFactors) {
    if (!Array.isArray(historicalFactors) || historicalFactors.length !== 13) {
        console.error("Error: finalizeFactorHistory requires 13 months of factor history, including the duplicate next-year month.");
        return [];
    }

    const rows = [...historicalFactors];

    for (let index = 1; index < rows.length; index++) {
        const expectedDate = new Date(
            duGetDateFromYYYYMMDD(rows[index - 1].fullDate).getFullYear(),
            duGetDateFromYYYYMMDD(rows[index - 1].fullDate).getMonth() + 1,
            1,
        );
        const actualDate = duGetDateFromYYYYMMDD(rows[index].fullDate);

        if (expectedDate.getTime() !== actualDate.getTime()) {
            console.error("Error: finalizeFactorHistory requires 13 consecutive monthly factor rows.");
            return [];
        }
    }

    return rows.slice(0, 12).map((r, index) => {
        const sfactor = r.factor;
        const nextFactor = rows[index + 1].factor;
        const sourceDate = duGetDateFromYYYYMMDD(r.fullDate);
        const dim = new Date(sourceDate.getFullYear(), sourceDate.getMonth() + 1, 0).getDate();
        const dailyDelta = (nextFactor - sfactor) / dim;
        const factor15th = sfactor + dailyDelta * 14;

        return {
            ...r,
            dim,
            dailyDelta,
            factor15th,
            factorYear: new Date().getFullYear(),
            startDate: r.calcStart,
            endDate: r.calcEnd,
        };
    });
}
