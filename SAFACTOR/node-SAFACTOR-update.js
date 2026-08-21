import {
    duDateLessThan,
    duGetDateDelta,
    duGetDateFromYYYYMMDD,
    duGetISOString
} from "../lib/dateUtils.mjs";
import {
    roundTo,
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
        factor: roundTo((100 * nsCPI / slCPI), 3),
    });
}
//console.error(`last full year: ${lastFullYear}`);
//console.error(`Retrieved ${months.length} months of CPI data, starting with ${months[0].fullDate} and ending with ${months[months.length - 1].fullDate}.`);
//console.error(JSON.stringify(months, null, 2));

// create an n-year factor history, starting with the most recent month, and including the previous n-1 months.
// The factor is calculated as the ratio of NS to SA CPI values, multiplied by 100.
// The daily delta is calculated as the difference between the current month's factor and the next month's factor,
// divided by the number of days in the month.
// The factor on the 15th of the month is calculated as the current month's factor plus the daily delta times 14.
function calcFactorHistory(years, type, months) {
    const lastDate = duGetDateFromYYYYMMDD(months[months.length - 1].fullDate);
    const earliestDate = new Date(lastDate.getFullYear() - years, lastDate.getMonth() + 1, 1);
    //console.error(`Earliest date for ${years}-year factor history: ${duGetISOString(earliestDate)}`);

    let factorGroups = [];
    for (let i = months.length - 1; i >= 0; i--) {
        const r = months[i];
        if (duDateLessThan(duGetDateFromYYYYMMDD(r.fullDate), earliestDate)) {
            break;
        }

        // add three months to r.month, wrap around modulo 12 (keeping 1-12 range)
        // The factors are adjusted forward 3 months from the CPI data as per TIPS methodology.
        const adjustedMonth = ((r.month + 3 - 1) % 12) + 1;

        if (!factorGroups[adjustedMonth]) {
            factorGroups[adjustedMonth] = [];
        }
        factorGroups[adjustedMonth].push({
            factor: r.factor,
            fullDate: r.fullDate,
            month: adjustedMonth,
        });
    }
    //console.error(JSON.stringify(factorGroups, null, 2));

    let historicalFactors = [];
    for (let i = 1; i <= 12; i++) {
        // calculate the average factor for each month over the 2-year period, and the daily delta and factor on the 15th of the month.
        if (factorGroups[i] && factorGroups[i].length > 0) {
            // find oldest month history.
            const avgFactor = roundTo((factorGroups[i].reduce((sum, r) => sum + r.factor, 0) / factorGroups[i].length), 4);
            const calcStart = factorGroups[i].reduce((min, r) => r.fullDate < min ? r.fullDate : min, factorGroups[i][0].fullDate);
            const calcEnd = factorGroups[i].reduce((max, r) => r.fullDate > max ? r.fullDate : max, factorGroups[i][0].fullDate);
            historicalFactors.push({
                type: type,
                factor: avgFactor,
                entriesTested: factorGroups[i].length,
                calcStart: calcStart,
                calcEnd: calcEnd,
                month: i,
            });
        }
    }
    // now level set the total of all the average factors to 100, by adjusting each factor by the ratio of 100 to the total of all average factors.
    //const totalFactor = historicalFactors.reduce((sum, r) => sum + r.factor, 0);
    //const adjustmentRatio = 1200 / totalFactor;
    //for (let i = 0; i < historicalFactors.length; i++) {
    //    historicalFactors[i].factor = roundTo((historicalFactors[i].factor * adjustmentRatio), 3);
    //}

    // calculate the daily delta and factor on the 15th of the month for each month, using the next month's factor as the end factor.
    // also output the results to the console in CSV format.
    for (let i = 0; i < historicalFactors.length; i++) {
        const r = historicalFactors[i];
        const sfactor = r.factor;
        const nextFactor = historicalFactors[(i + 1) % historicalFactors.length];
        const efactor = nextFactor.factor;
        const dim = new Date(new Date().getFullYear(), r.month, 0).getDate();
        const dailyDelta = roundTo(((efactor - sfactor) / dim), 3);
        const factor15th = roundTo((sfactor + dailyDelta * 14), 3);
        historicalFactors[i].dim = dim;
        historicalFactors[i].dailyDelta = dailyDelta;
        historicalFactors[i].factor15th = factor15th;
        historicalFactors[i].factorYear = new Date().getFullYear();
        historicalFactors[i].startDate = r.calcStart;
        historicalFactors[i].endDate = r.calcEnd;
        console.log(`${r.type},${r.month},${r.factor15th},${r.factor},${r.dailyDelta},${r.factorYear},${r.startDate},${r.endDate},${r.entriesTested}`);
    }
    //console.log(JSON.stringify(historicalFactors, null, 2));
    return historicalFactors;
}

console.log(`type,month,factor15th,factor,dailyDelta,factorYear,startDate,endDate,entriesTested`);
// use most recent data (up to last month!)
calcFactorHistory(1, "recent", allFactors);
// remove partial year factors.
let fullYearFactors = allFactors.filter(r => r.year <= lastFullYear );

// continue with full years only.
const oneYearFactors = calcFactorHistory(1, "1-year", fullYearFactors);
const twoYearFactors = calcFactorHistory(2, "2-year", fullYearFactors);
const fiveYearFactors = calcFactorHistory(5, "5-year", fullYearFactors);
const tenYearFactors = calcFactorHistory(10, "10-year", fullYearFactors);
const twentyYearFactors = calcFactorHistory(20, "20-year", fullYearFactors);
const thirtyYearFactors = calcFactorHistory(30, "30-year", fullYearFactors);

// remove the highest and lowest factor from each of the 10, 20, and 30 year factor arrays, and recalculate the average factor for each month.
function removeOutliersAndRecalculate(years, type, months) {
    let factorGroups = [];
    for (let i = 0; i < months.length; i++) {
        const r = months[i];
        const adjustedMonth = ((r.month + 3 - 1) % 12) + 1;
        if (!factorGroups[adjustedMonth]) {
            factorGroups[adjustedMonth] = [];
        }
        factorGroups[adjustedMonth].push(r.factor);
    }
    let historicalFactors = [];
    for (let i = 1; i <= 12; i++) {
        if (factorGroups[i] && factorGroups[i].length > 0) {
            const adjustedMonthEntries = months.filter(r => ((r.month + 3 - 1) % 12) + 1 === i);
            // remove the highest and lowest factor from the array.
            const trimmedFactors = [...factorGroups[i]].sort((a, b) => a - b);
            if (trimmedFactors.length > 2) {
                trimmedFactors.shift();
                trimmedFactors.pop();
            }
            const avgFactor = roundTo((trimmedFactors.reduce((sum, r) => sum + r, 0) / trimmedFactors.length), 4);
            // include calcstart and calcend dates for the factors used in the average calculation.
            const calcStart = adjustedMonthEntries.reduce((min, r) => r.fullDate < min ? r.fullDate : min, adjustedMonthEntries[0].fullDate);
            const calcEnd = adjustedMonthEntries.reduce((max, r) => r.fullDate > max ? r.fullDate : max, adjustedMonthEntries[0].fullDate);
            historicalFactors.push({
                type: type,
                factor: avgFactor,
                month: i,
                calcStart: calcStart,
                calcEnd: calcEnd,
                entriesTested: trimmedFactors.length,
            });
        }
    }
    // now level set the total of all the average factors to 100, by adjusting each factor by the ratio of 100 to the total of all average factors.
    const totalFactor = historicalFactors.reduce((sum, r) => sum + r.factor, 0);
    const adjustmentRatio = 1200 / totalFactor;
    for (let i = 0; i < historicalFactors.length; i++) {
        historicalFactors[i].factor = roundTo((historicalFactors[i].factor * adjustmentRatio), 3);
    }
    // calculate the daily delta and factor on the 15th of the month for each month, using the next month's factor as the end factor.
    for (let i = 0; i < historicalFactors.length; i++) {
        const r = historicalFactors[i];
        const sfactor = r.factor;
        const nextFactor = historicalFactors[(i + 1) % historicalFactors.length];
        const efactor   = nextFactor.factor;
        const dim = new Date(new Date().getFullYear(), r.month, 0).getDate();
        const dailyDelta = roundTo(((efactor - sfactor) / dim), 3);
        const factor15th = roundTo((sfactor + dailyDelta * 14), 3);
        historicalFactors[i].dim = dim;
        historicalFactors[i].dailyDelta = dailyDelta;
        historicalFactors[i].factor15th = factor15th;
        historicalFactors[i].factorYear = new Date().getFullYear();
        console.log(`${r.type},${r.month},${r.factor15th},${r.factor},${r.dailyDelta},${r.factorYear},${r.calcStart},${r.calcEnd},${r.entriesTested}`);
    }
    return historicalFactors;
}
const sevenYearSourceFactors = fullYearFactors.filter(r => r.year >= lastFullYear - 6 && r.year <= lastFullYear);
const tenYearSourceFactors = fullYearFactors.filter(r => r.year >= lastFullYear - 9 && r.year <= lastFullYear);
const twentyYearSourceFactors = fullYearFactors.filter(r => r.year >= lastFullYear - 19 && r.year <= lastFullYear);
const thirtyYearSourceFactors = fullYearFactors.filter(r => r.year >= lastFullYear - 29 && r.year <= lastFullYear);

const sevenYearTrimmedSeries = removeOutliersAndRecalculate(7, "7-year trimmed", sevenYearSourceFactors);
const tenYearTrimmedSeries = removeOutliersAndRecalculate(10, "10-year trimmed", tenYearSourceFactors);
const twentyYearTrimmedSeries = removeOutliersAndRecalculate(20, "20-year trimmed", twentyYearSourceFactors);
const thirtyYearTrimmedSeries = removeOutliersAndRecalculate(30, "30-year trimmed", thirtyYearSourceFactors);

function buildFactorDataset(months, trimOutliers) {
    const factorGroups = [];
    for (const r of months) {
        const adjustedMonth = ((r.month + 3 - 1) % 12) + 1;
        if (!factorGroups[adjustedMonth]) factorGroups[adjustedMonth] = [];
        factorGroups[adjustedMonth].push(r.factor);
    }

    const dataset = new Map();
    for (let month = 1; month <= 12; month++) {
        if (!factorGroups[month] || factorGroups[month].length === 0) continue;
        const factors = [...factorGroups[month]].sort((a, b) => a - b);
        if (trimOutliers && factors.length > 2) {
            factors.shift();
            factors.pop();
        }
        const average = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
        dataset.set(month, roundTo(average, 4));
    }

    if (trimOutliers) {
        const adjustmentRatio = 1200 / [...dataset.values()].reduce((sum, factor) => sum + factor, 0);
        for (const [month, factor] of dataset) {
            dataset.set(month, roundTo(factor * adjustmentRatio, 3));
        }
    }
    return dataset;
}

function evaluateDataset(label, years, trimOutliers) {
    const errors = [];
    const firstYear = fullYearFactors[0].year;
    for (let targetYear = firstYear + years; targetYear <= lastFullYear; targetYear++) {
        const sourceFactors = fullYearFactors.filter(r => r.year >= targetYear - years && r.year < targetYear);
        const dataset = buildFactorDataset(sourceFactors, trimOutliers);
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
        const dataset = buildFactorDataset(sourceFactors, trimOutliers);
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

// older statistical comparison code, kept for reference, but not used in the current analysis.
/*
function compareFactorSeries(label, seriesA, seriesB) {
    const monthMapA = new Map(seriesA.map(r => [r.month, r.factor]));
    const monthMapB = new Map(seriesB.map(r => [r.month, r.factor]));
    const months = [...new Set([...monthMapA.keys(), ...monthMapB.keys()])].sort((a, b) => a - b)
        .filter(month => monthMapA.has(month) && monthMapB.has(month));

    if (months.length === 0) {
        console.error(`${label}: no matching months found.`);
        return null;
    }

    const diffs = months.map(month => {
        const a = monthMapA.get(month);
        const b = monthMapB.get(month);
        const diff = a - b;
        const pct = (diff / b) * 100;
        return { month, a, b, diff, pct };
    });

    const meanDiff = diffs.reduce((sum, r) => sum + r.diff, 0) / diffs.length;
    const variance = diffs.reduce((sum, r) => sum + ((r.diff - meanDiff) ** 2), 0) / diffs.length;
    const stdDev = Math.sqrt(variance);
    const meanAbsPct = diffs.reduce((sum, r) => sum + Math.abs(r.pct), 0) / diffs.length;

    const report = {
        label,
        monthsCompared: diffs.length,
        meanDiff,
        variance,
        stdDev,
        meanAbsPct,
        diffs: diffs.map(r => ({ month: r.month, diff: r.diff, pct: r.pct }))
    };

    console.error([
        label,
        report.monthsCompared,
        roundTo(report.meanDiff, 6),
        roundTo(report.variance, 6),
        roundTo(report.stdDev, 6),
        roundTo(report.meanAbsPct, 6)
    ].join(","));
    return report;
}


console.error("label,monthsCompared,meanDiff,variance,stdDev,meanAbsPct");

compareFactorSeries("1-year vs 5-year", oneYearFactors, fiveYearFactors);
compareFactorSeries("1-year vs 7-year-trimmed", oneYearFactors, sevenYearTrimmedSeries);
compareFactorSeries("1-year vs 10-year-trimmed", oneYearFactors, tenYearTrimmedSeries);
compareFactorSeries("1-year vs 20-year-trimmed", oneYearFactors, twentyYearTrimmedSeries);
compareFactorSeries("1-year vs 30-year-trimmed", oneYearFactors, thirtyYearTrimmedSeries);
compareFactorSeries("5-year vs 7-year-trimmed", fiveYearFactors, sevenYearTrimmedSeries);
compareFactorSeries("5-year vs 10-year-trimmed", fiveYearFactors, tenYearTrimmedSeries);
compareFactorSeries("5-year vs 20-year-trimmed", fiveYearFactors, twentyYearTrimmedSeries);
compareFactorSeries("5-year vs 30-year-trimmed", fiveYearFactors, thirtyYearTrimmedSeries);
compareFactorSeries("5-year vs 10-year", fiveYearFactors, tenYearFactors);
compareFactorSeries("5-year vs 20-year", fiveYearFactors, twentyYearFactors);
compareFactorSeries("5-year vs 30-year", fiveYearFactors, thirtyYearFactors);
compareFactorSeries("7-year-trimmed vs 10-year-trimmed", sevenYearTrimmedSeries, tenYearTrimmedSeries);
compareFactorSeries("7-year-trimmed vs 20-year-trimmed", sevenYearTrimmedSeries, twentyYearTrimmedSeries);
compareFactorSeries("7-year-trimmed vs 30-year-trimmed", sevenYearTrimmedSeries, thirtyYearTrimmedSeries);
*/

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

console.log("dataset,years,trimOutliers,monthsCompared,overallMae,recent10Mae,weightedMae,overallShapeMae,weightedShapeMae,commonPeriodMonthsCompared,commonPeriodWeightedShapeMae,recent10YearForecastMonthsCompared,recent10YearForecastShapeMae,overallRmse,recent10Rmse,meanBias,weightedMeanAbsPct");
const datasetAnalysis = datasetsToEvaluate
    .map(dataset => evaluateDataset(dataset.label, dataset.years, dataset.trimOutliers))
    .sort((a, b) => (b.recent10YearForecastShapeMae ?? -Infinity)
        - (a.recent10YearForecastShapeMae ?? -Infinity));
const formatAnalysisValue = value => value === null ? "NA" : roundTo(value, 6);
const rankedDatasets = datasetAnalysis.filter(result => result.recent10YearForecastShapeMae !== null);
for (const result of rankedDatasets) {
    console.log([
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
        result.recent10YearForecastShapeMae < best.recent10YearForecastShapeMae ? result : best);
        console.log(`best recent 10-year forecast shape dataset,${bestDataset.label}`);
