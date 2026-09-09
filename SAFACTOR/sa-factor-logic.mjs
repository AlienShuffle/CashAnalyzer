import {
    duDateLessThan,
    duGetDateFromYYYYMMDD
} from "../lib/dateUtils.mjs";
import {
    roundToFixed
} from "../lib/utils.mjs";

export async function getCPIMonths(metric) {
    const startDate = new Date(1966, 0, 1);
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

export function buildAllFactors(slMonths, nsMonths) {
    let allFactors = [];
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

        allFactors.push({
            fullDate: slMonths[i].fullDate,
            year,
            month,
            CPINS: nsCPI,
            CPISL: slCPI,
            factor: roundToFixed((nsCPI / slCPI), 8, 9),
        });
    }

    return { allFactors, lastFullYear };
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

export function createErrorStatsHelpers(recentStartYear = null) {
    const average = (rows, selector) => rows.length === 0 ? null
        : rows.reduce((sum, row) => sum + selector(row), 0) / rows.length;

    const weightedAverage = (rows, selector) => {
        if (rows.length === 0) return null;
        if (recentStartYear === null) {
            return average(rows, selector);
        }

        const weightedRows = rows.map(row => ({
            row,
            weight: row.year >= recentStartYear ? 2 : 1,
        }));

        return weightedRows.reduce((sum, item) => sum + item.weight * selector(item.row), 0)
            / weightedRows.reduce((sum, item) => sum + item.weight, 0);
    };

    return { average, weightedAverage };
}

export function calculateFactorAverages(months, trimOutliers = false) {
    const factorGroups = [];
    for (const r of months) {
        const adjustedMonth = ((r.month + 3 - 1) % 12) + 1;
        if (!factorGroups[adjustedMonth]) factorGroups[adjustedMonth] = [];
        factorGroups[adjustedMonth].push(r);
    }

    const historicalFactors = [];
    for (let month = 1; month <= 12; month++) {
        const entries = factorGroups[month];
        if (!entries || entries.length === 0) continue;

        const factors = entries.map(r => r.factor).sort((a, b) => a - b);
        if (trimOutliers && factors.length > 2) {
            factors.shift();
            factors.pop();
        }

        const average = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
        const calcStart = entries.reduce((min, r) => r.fullDate < min ? r.fullDate : min, entries[0].fullDate);
        const calcEnd = entries.reduce((max, r) => r.fullDate > max ? r.fullDate : max, entries[0].fullDate);

        historicalFactors.push({
            factor: roundToFixed(average, 5, 6),
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
            historicalFactor.factor = roundToFixed(historicalFactor.factor * adjustmentRatio, 5, 6);
        }
    }

    return historicalFactors;
}

export function createSAValues(historyMonths, monthsToAdjust) {
    const sortedHistory = [...historyMonths].sort((a, b) =>
        duGetDateFromYYYYMMDD(a.fullDate) - duGetDateFromYYYYMMDD(b.fullDate));
    const sortedTargetMonths = [...monthsToAdjust].sort((a, b) =>
        duGetDateFromYYYYMMDD(a.fullDate) - duGetDateFromYYYYMMDD(b.fullDate));

    if (sortedHistory.length < 13) {
        console.error("Error: createSAValues requires at least 13 months of history to build the moving-average seasonal pattern.");
        process.exit(1);
    }

    const seasonalFactors = buildSeasonalFactors(sortedHistory);
    if (!seasonalFactors) {
        console.error("Error: createSAValues could not build a valid seasonal pattern from the CPINS history.");
        process.exit(1);
    }

    return sortedTargetMonths.map((r) => {
        const monthIndex = duGetDateFromYYYYMMDD(r.fullDate).getMonth();
        const seasonalFactor = seasonalFactors[monthIndex];

        if (!Number.isFinite(seasonalFactor)) {
            console.error(`Error: no seasonal factor found for month ${monthIndex + 1} in createSAValues.`);
            process.exit(1);
        }

        const saValue = roundToFixed(r.CPINS / (seasonalFactor / 100), 8, 9);

        return {
            ...r,
            CPISL: saValue,
            factor: roundToFixed(r.CPINS / saValue, 8, 9),
        };
    });
}

export function buildSeasonalFactors(months) {
    // console.error(`Building seasonal factors from ${months.length} months of data, starting with ${months[0].fullDate} and ending with ${months[months.length - 1].fullDate}.`);

    if (!Array.isArray(months) || months.length < 13) {
        console.error("Error: buildSeasonalFactors requires at least 13 months of CPINS history.");
        return null;
    }

    const ratios = [];

    for (let i = 6; i <= months.length - 7; i++) {
        let ma = 0;

        for (let j = i - 6; j <= i + 5; j++) {
            ma += months[j].CPINS;
        }

        ma /= 12;

        ratios.push({
            month: duGetDateFromYYYYMMDD(months[i].fullDate).getMonth(),
            ratio: 100 * months[i].CPINS / ma,
        });
    }

    const monthValues = Array.from({ length: 12 }, () => []);
    ratios.forEach(r => {
        monthValues[r.month].push(r.ratio);
    });

    const factors = monthValues.map((values, index) => {
        if (values.length === 0) {
            console.error(`Warning: no moving-average ratios available for month ${index + 1}; skipping that month.`);
            return null;
        }
        return values.reduce((a, b) => a + b, 0) / values.length;
    });

    const validFactors = factors.filter(value => Number.isFinite(value));
    if (validFactors.length === 0) {
        console.error("Error: buildSeasonalFactors produced no valid factors.");
        return null;
    }

    const avg = validFactors.reduce((a, b) => a + b, 0) / validFactors.length;
    const normalized = factors.map(f => f === null ? null : 100 * f / avg);

    // console.error(`Seasonal factors length: ${normalized.length}: ${normalized.map(f => f === null ? "NA" : roundToFixed(f, 5, 6)).join(", ")}`);
    return normalized;
}

export function buildMonthFactorMap(months, trimOutliers = false) {
    return new Map(
        calculateFactorAverages(months, trimOutliers).map(r => [r.month, r.factor])
    );
}

export function enrichFactorHistory(historicalFactors) {
    return historicalFactors.map((r, index, rows) => {
        const sfactor = r.factor;
        const nextFactor = rows[(index + 1) % rows.length];
        const dim = new Date(new Date().getFullYear(), r.month, 0).getDate();
        const dailyDelta = roundToFixed(((nextFactor.factor - sfactor) / dim), 8, 9);
        const factor15th = roundToFixed((sfactor + dailyDelta * 14), 5, 6);

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

export function finalizeFactorHistory(historicalFactors) {
    return enrichFactorHistory(historicalFactors);
}

