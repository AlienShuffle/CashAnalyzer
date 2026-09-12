import {
    buildBlsNsChapsalisFactorRows,
    buildBlsNsSaFactors,
    calculateBlsFactorAverages,
    finalizeFactorHistory,
    getCPIMonths,
    getMonthsInWindow,
    getTipsAdjustedMonth,
} from "./sa-factor-logic.mjs";
import { writeFileSync } from "node:fs";
import { duGetDateFromYYYYMMDD } from "../lib/dateUtils.mjs";
import { roundToFixed } from "../lib/utils.mjs";

function formatWindowDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildFactorWindowDatasets(latestWindowDate) {
    const latestFullYear = latestWindowDate.getMonth() === 11
        ? latestWindowDate.getFullYear()
        : latestWindowDate.getFullYear() - 1;

    const last12MonthsStartDate = formatWindowDate(
        new Date(latestWindowDate.getFullYear(), latestWindowDate.getMonth() - 12, 1)
    );

    console.error(`Latest window date: ${latestWindowDate.toISOString()}, last 12 months start date: ${last12MonthsStartDate}`);
    const last12MonthsEndDate = formatWindowDate(latestWindowDate);
    const last5FullYearsStartDate = formatWindowDate(new Date(latestFullYear - 5, 11, 1));
    const last10FullYearsStartDate = formatWindowDate(new Date(latestFullYear - 10, 11, 1));
    const calendarYearStartDate = `${latestFullYear - 1}-12-01`;
    const calendarYearEndDate = `${latestFullYear}-12-01`;

    return [
        {
            label: "last-12-months",
            startDate: last12MonthsStartDate,
            endDate: last12MonthsEndDate,
            trimOutliers: false,
        },
        /*
        {
            label: `calendar-year-${latestFullYear}`,
            startDate: calendarYearStartDate,
            endDate: calendarYearEndDate,
            trimOutliers: false,
        },
        {
            label: "last-5-full-years",
            startDate: last5FullYearsStartDate,
            endDate: calendarYearEndDate,
            trimOutliers: false,
        },
        {
            label: "last-10-full-years",
            startDate: last10FullYearsStartDate,
            endDate: calendarYearEndDate,
            trimOutliers: false,
        },
        {
            label: "last-10-full-years-trimmed",
            startDate: last10FullYearsStartDate,
            endDate: calendarYearEndDate,
            trimOutliers: true,
        },
        */
    ];
}

function printFactorHistoryRows(label, rows) {
    for (const row of [...rows].sort((a, b) => a.month - b.month)) {
        console.log([
            label,
            row.month,
            roundToFixed(row.factor15th, 5),
            roundToFixed(row.factor, 5),
            roundToFixed(row.dailyDelta, 8),
            row.factorYear,
            row.startDate,
            row.endDate,
            row.entriesTested,
        ].join(","));
    }
}

function buildChronologicalFactorRows(sourceMonths, getFactor, entriesTested) {
    const chronologicalMonths = sourceMonths.slice(-13);

    if (chronologicalMonths.length !== 13) {
        console.error("Error: factor history requires 13 consecutive source months.");
        return [];
    }

    return chronologicalMonths.map((sourceMonth) => ({
        ...sourceMonth,
        month: getTipsAdjustedMonth(sourceMonth.month),
        factor: getFactor(sourceMonth),
        calcStart: sourceMonth.fullDate,
        calcEnd: sourceMonth.fullDate,
        entriesTested,
    }));
}

function buildCpiHistoryCsv(blsNsSaFactors, blsNsChapsalisFactors) {
    const chapsalisFactorMap = new Map(
        blsNsChapsalisFactors.map(row => [row.month, row.factor])
    );

    const lines = [
        ["date", "BLS_CPINS", "BLS_CPISA", "Chapsalis_CPISA"].join(","),
    ];

    for (const row of blsNsSaFactors) {
        const chapsalisAdjustedCpi = row.CPINS / chapsalisFactorMap.get(row.month);

        lines.push([
            row.fullDate,
            row.CPINS,
            row.CPISL,
            roundToFixed(chapsalisAdjustedCpi, 3, 4),
        ].join(","));
    }

    return `${lines.join("\n")}\n`;
}

export async function runSaFactorPipeline() {
    const slMonths = await getCPIMonths("CPIAUCSL");
    const nsMonths = await getCPIMonths("CPIAUCNS");
    const { blsFactors: blsNsSaFactors } = buildBlsNsSaFactors(slMonths, nsMonths);

    // preamble Flow: raw BLS NS/SA factors & raw Chapsalis factors -> CPI history table.
    const blsNsChapsalisFactorRows = buildBlsNsChapsalisFactorRows(blsNsSaFactors);

    if (!blsNsChapsalisFactorRows) {
        console.error("Error: could not build BLS NS Chapsalis factor rows for CPI history export.");
        process.exit(1);
    }

    writeFileSync(
        new URL("./cpi-history.csv", import.meta.url),
        buildCpiHistoryCsv(blsNsSaFactors, blsNsChapsalisFactorRows),
        "utf8"
    );

    const latestWindowDate = duGetDateFromYYYYMMDD(blsNsSaFactors[blsNsSaFactors.length - 1].fullDate);
    const factorWindowDatasets = buildFactorWindowDatasets(latestWindowDate);

    console.log(`type,month,factor15th,factor,dailyDelta,factorYear,startDate,endDate,entriesTested`);

    // Flow 1: print the BLS NS/SA factor-table rows for the synchronized window set.
    for (const dataset of factorWindowDatasets) {
        const sourceMonths = getMonthsInWindow(blsNsSaFactors, dataset.startDate, dataset.endDate);

        if (sourceMonths.length === 0) {
            console.error(`Error: ${dataset.label} requested window ${dataset.startDate} through ${dataset.endDate} returned no data.`);
            process.exit(1);
        }

        const usesRawFactors = sourceMonths.length === 13;
        const factorRows = usesRawFactors
            ? []
            : calculateBlsFactorAverages(sourceMonths, dataset.trimOutliers);
        const factorByMonth = new Map(factorRows.map(row => [row.month, row.factor]));
        const historyRows = buildChronologicalFactorRows(
            sourceMonths,
            usesRawFactors
                ? sourceMonth => sourceMonth.factor
                : sourceMonth => factorByMonth.get(getTipsAdjustedMonth(sourceMonth.month)),
            usesRawFactors
                ? 1
                : factorRows[0]?.entriesTested,
        );

        printFactorHistoryRows(
            `${dataset.label}-BLS`,
            finalizeFactorHistory(historyRows)
        );
    }
    /*
        // Flow 2: print the BLS NS -> Chapsalis factor-table rows for the same synchronized window set.
        for (const dataset of factorWindowDatasets) {
            const sourceMonths = getMonthsInWindow(blsNsSaFactors, dataset.startDate, dataset.endDate);
            const sourceBlsNsChapsalisFactorRows = buildBlsNsChapsalisFactorRows(sourceMonths);
    
            if (!sourceBlsNsChapsalisFactorRows) {
                console.error(`Error: ${dataset.label} requested window ${dataset.startDate} through ${dataset.endDate} does not have enough months for the BLS NS Chapsalis factor pattern.`);
                process.exit(1);
            }
    
            const chapsalisFactorByMonth = new Map(
                sourceBlsNsChapsalisFactorRows.map(row => [row.month, row.factor])
            );
            const historyRows = buildChronologicalFactorRows(
                sourceMonths,
                sourceMonth => chapsalisFactorByMonth.get(getTipsAdjustedMonth(sourceMonth.month)),
                sourceBlsNsChapsalisFactorRows[0]?.entriesTested,
            );
    
            printFactorHistoryRows(
                `${dataset.label}-Chapsalis`,
                finalizeFactorHistory(historyRows)
            );
        }
    */
}
