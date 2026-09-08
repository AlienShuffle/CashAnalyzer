import {
    duDateLessThan,
    duGetDateFromYYYYMMDD
} from "../lib/dateUtils.mjs";
import {
    roundToFixed
} from "../lib/utils.mjs";

// pull in a CPI metric and create a metric array.
async function getCPIMonths(metric) {
    const startDate = new Date(1966, 0, 1);
    const response = await fetch(`https://cashoptimizer.pages.dev/Treasuries/${metric}.csv`);
    const text = await response.text();
    const rows = text.split("\n");
    // skip header, strip out all dates before startDate and all rows with missing CPI values
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
            CPI: CPI,
        });
    }
    if (filtered.length <= 50) {
        console.error(`Error: ${metric}, Not enough data points retrieved. probaby intermittent issue.`);
        process.exit(1);
    }
    return filtered;
}
const slMonths = await getCPIMonths("CPIAUCSL"); // Seasonally adjusted.
const nsMonths = await getCPIMonths("CPIAUCNS"); // Not seasonally adjusted.
function getNSCPI(year, month) {
    for (let i = nsMonths.length - 1; i >= 0; i--) {
        if (nsMonths[i].year === year && nsMonths[i].month === month) {
            return nsMonths[i].CPI;
        }
    }
    return null;
}

// Create a basic factor array that includes factor, and SA and NS CPI values for each month.
// The factor is the ratio of NS to SA CPI values, multiplied by 100.   
let allFactors = [];
let lastFullYear = null;
for (let i = 0; i < slMonths.length; i++) {
    const year = slMonths[i].year;
    const month = slMonths[i].month;
    const slCPI = slMonths[i].CPI;
    const nsCPI = getNSCPI(year, month);
    if (nsCPI === null) {
        console.error(`Error: ${year}-${month}, No matching NS CPI value found.`);
        process.exit(1);
    }
    if (year > lastFullYear && month === 12) {
        lastFullYear = year;
    }
    allFactors.push({
        fullDate: slMonths[i].fullDate,
        year: year,
        month: month,
        CPINS: nsCPI,
        CPISL: slCPI,
        factor: roundToFixed((nsCPI / slCPI), 8, 9),
    });
}
//console.error(`last full year: ${lastFullYear}`);
//console.error(`Retrieved ${months.length} months of CPI data, starting with ${months[0].fullDate} and ending with ${months[months.length - 1].fullDate}.`);
//console.error(JSON.stringify(months, null, 2));

// create an n-year factor history, starting with the most recent month, and including the previous n-1 months.
// The factor is calculated as the ratio of NS to SA CPI values.
// The daily delta is calculated as the difference between the current month's factor and the next month's factor,
// divided by the number of days in the month.
// The factor on the 15th of the month is calculated as the current month's factor plus the daily delta times 14.
function calculateFactorAverages(months, trimOutliers = false) {
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
            month: month,
            calcStart: calcStart,
            calcEnd: calcEnd,
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

function finalizeFactorHistory(historicalFactors, type, output = true) {
    for (let i = 0; i < historicalFactors.length; i++) {
        const r = historicalFactors[i];
        const sfactor = r.factor;
        const nextFactor = historicalFactors[(i + 1) % historicalFactors.length];
        const dim = new Date(new Date().getFullYear(), r.month, 0).getDate();
        const dailyDelta = roundToFixed(((nextFactor.factor - sfactor) / dim), 8, 9);
        const factor15th = roundToFixed((sfactor + dailyDelta * 14), 5, 6);
        r.dim = dim;
        r.dailyDelta = dailyDelta;
        r.factor15th = factor15th;
        r.factorYear = new Date().getFullYear();
        r.startDate = r.calcStart;
        r.endDate = r.calcEnd;
        if (output) {
            console.log(`${type},${r.month},${r.factor15th},${r.factor},${r.dailyDelta},${r.factorYear},${r.startDate},${r.endDate},${r.entriesTested}`);
        }
    }
    return historicalFactors;
}

function calcFactorHistory(years, type, months) {
    const lastDate = duGetDateFromYYYYMMDD(months[months.length - 1].fullDate);
    const earliestDate = new Date(lastDate.getFullYear() - years, lastDate.getMonth() + 1, 1);
    //console.error(`Earliest date for ${years}-year factor history: ${duGetISOString(earliestDate)}`);

    const sourceMonths = months.filter(r =>
        !duDateLessThan(duGetDateFromYYYYMMDD(r.fullDate), earliestDate));
    return finalizeFactorHistory(calculateFactorAverages(sourceMonths), type);
}

console.log(`type,month,factor15th,factor,dailyDelta,factorYear,startDate,endDate,entriesTested`);
// use most recent data (up to last month!)
calcFactorHistory(1, "recent", allFactors);
// remove partial year factors.
let fullYearFactors = allFactors.filter(r => r.year <= lastFullYear);

// continue with full years only, this is run to create the .csv output lines for set.
const oneYearFactors = calcFactorHistory(1, "1-year", fullYearFactors);
const twoYearFactors = calcFactorHistory(2, "2-year", fullYearFactors);
const fiveYearFactors = calcFactorHistory(5, "5-year", fullYearFactors);
const tenYearFactors = calcFactorHistory(10, "10-year", fullYearFactors);
const twentyYearFactors = calcFactorHistory(20, "20-year", fullYearFactors);
const thirtyYearFactors = calcFactorHistory(30, "30-year", fullYearFactors);

// Remove the highest and lowest factor from each requested year range and recalculate the monthly averages.
function removeOutliersAndRecalculate(years, type, months) {
    const latestYear = Math.max(...months.map(r => r.year));
    const sourceMonths = months.filter(r =>
        r.year >= latestYear - years + 1 && r.year <= latestYear);
    return finalizeFactorHistory(calculateFactorAverages(sourceMonths, true), type);
}
const sevenYearTrimmedSeries = removeOutliersAndRecalculate(7, "7-year trimmed", fullYearFactors);
const tenYearTrimmedSeries = removeOutliersAndRecalculate(10, "10-year trimmed", fullYearFactors);
const twentyYearTrimmedSeries = removeOutliersAndRecalculate(20, "20-year trimmed", fullYearFactors);
const thirtyYearTrimmedSeries = removeOutliersAndRecalculate(30, "30-year trimmed", fullYearFactors);

function evaluateDataset(label, years, trimOutliers) {
    const errors = [];
    const firstYear = fullYearFactors[0].year;
    for (let targetYear = firstYear + years; targetYear <= lastFullYear; targetYear++) {
        const sourceFactors = fullYearFactors.filter(r => r.year >= targetYear - years && r.year < targetYear);
        const dataset = new Map(calculateFactorAverages(sourceFactors, trimOutliers)
            .map(r => [r.month, r.factor]));
        const targetFactors = fullYearFactors.filter(r => r.year === targetYear);
        const comparisons = [];
        for (const target of targetFactors) {
            const adjustedMonth = ((target.month + 3 - 1) % 12) + 1;
            const predicted = dataset.get(adjustedMonth);
            if (predicted === undefined) continue;
            comparisons.push({ target, predicted });
        }
        const predictedMean = comparisons.length === 0
            ? null
            : comparisons.reduce((sum, row) => sum + row.predicted, 0) / comparisons.length;
        const targetMean = comparisons.length === 0
            ? null
            : comparisons.reduce((sum, row) => sum + row.target.factor, 0) / comparisons.length;
        for (const { target, predicted } of comparisons) {
            const error = predicted - target.factor;
            const normalizedPredicted = predicted / predictedMean;
            const normalizedTarget = target.factor / targetMean;
            const shapeError = normalizedPredicted - normalizedTarget;
            errors.push({
                year: targetYear,
                error,
                absoluteError: Math.abs(error),
                squaredError: error ** 2,
                absolutePctError: Math.abs(error / target.factor) * 100,
                shapeAbsoluteError: Math.abs(shapeError),
                shapeSquaredError: shapeError ** 2,
            });
        }
    }

    const recentStartYear = lastFullYear - 9;
    const commonPeriodStartYear = lastFullYear - 29;
    const recentErrors = errors.filter(r => r.year >= recentStartYear);
    const commonPeriodErrors = errors.filter(r => r.year >= commonPeriodStartYear);
    const recentForecastOriginStart = lastFullYear - 19;
    const recentForecastOriginEnd = lastFullYear - 10;
    const forecastShapeErrors = [];
    for (let originYear = recentForecastOriginStart; originYear <= recentForecastOriginEnd; originYear++) {
        const sourceFactors = fullYearFactors.filter(r =>
            r.year >= originYear - years + 1 && r.year <= originYear);
        const dataset = new Map(calculateFactorAverages(sourceFactors, trimOutliers)
            .map(r => [r.month, r.factor]));
        for (let horizon = 1; horizon <= 10; horizon++) {
            const targetYear = originYear + horizon;
            const targetFactors = fullYearFactors.filter(r => r.year === targetYear);
            const comparisons = targetFactors.map(target => ({
                target,
                predicted: dataset.get(((target.month + 3 - 1) % 12) + 1),
            })).filter(row => row.predicted !== undefined);
            if (comparisons.length === 0) continue;
            const predictedMean = comparisons.reduce((sum, row) => sum + row.predicted, 0)
                / comparisons.length;
            const targetMean = comparisons.reduce((sum, row) => sum + row.target.factor, 0)
                / comparisons.length;
            for (const { target, predicted } of comparisons) {
                forecastShapeErrors.push(Math.abs(
                    (predicted / predictedMean) - (target.factor / targetMean)));
            }
        }
    }
    const average = (rows, selector) => rows.length === 0 ? null
        : rows.reduce((sum, row) => sum + selector(row), 0) / rows.length;
    const weightedAverage = (rows, selector) => {
        if (rows.length === 0) return null;
        const weightedRows = rows.map(row => ({
            row,
            weight: row.year >= recentStartYear ? 2 : 1,
        }));
        return weightedRows.reduce((sum, item) => sum + item.weight * selector(item.row), 0)
            / weightedRows.reduce((sum, item) => sum + item.weight, 0);
    };

    return {
        label,
        years,
        trimOutliers,
        monthsCompared: errors.length,
        overallMae: average(errors, r => r.absoluteError),
        recent10Mae: average(recentErrors, r => r.absoluteError),
        weightedMae: weightedAverage(errors, r => r.absoluteError),
        overallShapeMae: average(errors, r => r.shapeAbsoluteError),
        weightedShapeMae: weightedAverage(errors, r => r.shapeAbsoluteError),
        commonPeriodMonthsCompared: commonPeriodErrors.length,
        commonPeriodWeightedShapeMae: weightedAverage(commonPeriodErrors, r => r.shapeAbsoluteError),
        recent10YearForecastMonthsCompared: forecastShapeErrors.length,
        recent10YearForecastShapeMae: forecastShapeErrors.length === 0 ? null
            : forecastShapeErrors.reduce((sum, error) => sum + error, 0) / forecastShapeErrors.length,
        overallRmse: average(errors, r => r.squaredError) === null ? null
            : Math.sqrt(average(errors, r => r.squaredError)),
        recent10Rmse: average(recentErrors, r => r.squaredError) === null ? null
            : Math.sqrt(average(recentErrors, r => r.squaredError)),
        meanBias: average(errors, r => r.error),
        weightedMeanAbsPct: weightedAverage(errors, r => r.absolutePctError),
    };
}

const datasetsToEvaluate = [
    { label: "1-year", years: 1, trimOutliers: false },
    { label: "2-year", years: 2, trimOutliers: false },
    { label: "5-year", years: 5, trimOutliers: false },
    { label: "7-year-trimmed", years: 7, trimOutliers: true },
    { label: "10-year", years: 10, trimOutliers: false },
    { label: "10-year-trimmed", years: 10, trimOutliers: true },
    { label: "20-year", years: 20, trimOutliers: false },
    { label: "20-year-trimmed", years: 20, trimOutliers: true },
    { label: "30-year", years: 30, trimOutliers: false },
    { label: "30-year-trimmed", years: 30, trimOutliers: true },
];

console.log(",dataset,years,trimOutliers,monthsCompared,overallMae,recent10Mae,weightedMae,overallShapeMae,weightedShapeMae,commonPeriodMonthsCompared,commonPeriodWeightedShapeMae,recent10YearForecastMonthsCompared,recent10YearForecastShapeMae,overallRmse,recent10Rmse,meanBias,weightedMeanAbsPct");
const datasetAnalysis = datasetsToEvaluate
    .map(dataset => evaluateDataset(dataset.label, dataset.years, dataset.trimOutliers))
    .sort((a, b) => (b.recent10YearForecastShapeMae ?? -Infinity)
        - (a.recent10YearForecastShapeMae ?? -Infinity));
const formatAnalysisValue = value => value === null ? "NA" : roundToFixed(value, 5, 6);
const rankedDatasets = datasetAnalysis.filter(result => result.recent10YearForecastShapeMae !== null);
for (const result of rankedDatasets) {
    console.log([
        "",
        result.label,
        result.years,
        result.trimOutliers,
        result.monthsCompared,
        formatAnalysisValue(result.overallMae),
        formatAnalysisValue(result.recent10Mae),
        formatAnalysisValue(result.weightedMae),
        formatAnalysisValue(result.overallShapeMae),
        formatAnalysisValue(result.weightedShapeMae),
        result.commonPeriodMonthsCompared,
        formatAnalysisValue(result.commonPeriodWeightedShapeMae),
        result.recent10YearForecastMonthsCompared,
        formatAnalysisValue(result.recent10YearForecastShapeMae),
        formatAnalysisValue(result.overallRmse),
        formatAnalysisValue(result.recent10Rmse),
        formatAnalysisValue(result.meanBias),
        formatAnalysisValue(result.weightedMeanAbsPct),
    ].join(","));
}
const bestDataset = rankedDatasets.reduce((best, result) =>
    result.recent10YearForecastShapeMae < best.recent10YearForecastShapeMae ? result : best
);
console.log(`,best recent 10-year forecast shape dataset,${bestDataset.label}`);
