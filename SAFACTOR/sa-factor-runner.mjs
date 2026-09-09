import {
    buildAllFactors,
    buildMonthFactorMap,
    calculateFactorAverages,
    createErrorStatsHelpers,
    createSAValues,
    finalizeFactorHistory,
    getCPIMonths,
    getMonthsInWindow,
} from "./sa-factor-logic.mjs";
import {
    duDateLessThan,
    duGetDateFromYYYYMMDD
} from "../lib/dateUtils.mjs";
import {
    roundToFixed
} from "../lib/utils.mjs";

function formatWindowDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function buildMovingAverageWindowDatasets(latestWindowDate) {
    return [
        {
            label: "june-2025-to-june-2026-moving-average",
            startDate: "2025-06-01",
            endDate: "2026-06-01"
        },
        {
            label: "5-year-moving-average",
            startDate: formatWindowDate(new Date(latestWindowDate.getFullYear() - 5, latestWindowDate.getMonth(), 1)),
            endDate: formatWindowDate(latestWindowDate),
        },
        {
            label: "10-year-moving-average",
            startDate: formatWindowDate(new Date(latestWindowDate.getFullYear() - 10, latestWindowDate.getMonth(), 1)),
            endDate: formatWindowDate(latestWindowDate),
        },
        {
            label: "20-year-moving-average",
            startDate: formatWindowDate(new Date(latestWindowDate.getFullYear() - 20, latestWindowDate.getMonth(), 1)),
            endDate: formatWindowDate(latestWindowDate),
        },
        {
            label: "30-year-moving-average",
            startDate: formatWindowDate(new Date(latestWindowDate.getFullYear() - 30, latestWindowDate.getMonth(), 1)),
            endDate: formatWindowDate(latestWindowDate),
        },
        {
            label: "12-month-moving-average",
            startDate: formatWindowDate(new Date(latestWindowDate.getFullYear(), latestWindowDate.getMonth() - 11, 1)),
            endDate: formatWindowDate(latestWindowDate),
        },
    ];
}

function printFactorHistoryRows(label, rows) {
    for (const row of rows) {
        console.log([
            label,
            row.month,
            row.factor15th,
            row.factor,
            row.dailyDelta,
            row.factorYear,
            row.startDate,
            row.endDate,
            row.entriesTested,
        ].join(","));
    }
}

export async function runSaFactorPipeline() {
    const slMonths = await getCPIMonths("CPIAUCSL"); // Seasonally adjusted.
    const nsMonths = await getCPIMonths("CPIAUCNS"); // Not seasonally adjusted.
    const { allFactors, lastFullYear } = buildAllFactors(slMonths, nsMonths);

    function calcFactorHistory(years, type, months) {
        const lastDate = duGetDateFromYYYYMMDD(months[months.length - 1].fullDate);
        const earliestDate = new Date(lastDate.getFullYear() - years, lastDate.getMonth() + 1, 1);

        const sourceMonths = months.filter(r =>
            !duDateLessThan(duGetDateFromYYYYMMDD(r.fullDate), earliestDate));
        return finalizeFactorHistory(calculateFactorAverages(sourceMonths), type);
    }

    function calcFactorHistoryForWindow(startDate, endDate, type, months) {
        const sourceMonths = getMonthsInWindow(months, startDate, endDate);

        if (sourceMonths.length === 0) {
            console.error(`Error: ${type} requested window ${startDate} through ${endDate} returned no data.`);
            process.exit(1);
        }

        return finalizeFactorHistory(calculateFactorAverages(sourceMonths), type);
    }

    console.log(`type,month,factor15th,factor,dailyDelta,factorYear,startDate,endDate,entriesTested`);
    printFactorHistoryRows("recent-BLS", calcFactorHistory(1, "recent-BLS", allFactors));

    const latestWindowDate = duGetDateFromYYYYMMDD(allFactors[allFactors.length - 1].fullDate);
    const movingAverageWindowDatasets = buildMovingAverageWindowDatasets(latestWindowDate);

    for (const dataset of movingAverageWindowDatasets) {
        printFactorHistoryRows(
            dataset.label,
            calcFactorHistoryForWindow(dataset.startDate, dataset.endDate, dataset.label, allFactors)
        );
    }

    const fullYearFactors = allFactors.filter(r => r.year <= lastFullYear);

    printFactorHistoryRows("1-year-BLS", calcFactorHistory(1, "1-year-BLS", fullYearFactors));
    printFactorHistoryRows("2-year-BLS", calcFactorHistory(2, "2-year-BLS", fullYearFactors));
    printFactorHistoryRows("5-year-BLS", calcFactorHistory(5, "5-year-BLS", fullYearFactors));
    printFactorHistoryRows("10-year-BLS", calcFactorHistory(10, "10-year-BLS", fullYearFactors));
    printFactorHistoryRows("20-year-BLS", calcFactorHistory(20, "20-year-BLS", fullYearFactors));
    printFactorHistoryRows("30-year-BLS", calcFactorHistory(30, "30-year-BLS", fullYearFactors));

    function removeOutliersAndRecalculate(years, type, months) {
        const latestYear = Math.max(...months.map(r => r.year));
        const sourceMonths = months.filter(r =>
            r.year >= latestYear - years + 1 && r.year <= latestYear);
        return finalizeFactorHistory(calculateFactorAverages(sourceMonths, true), type);
    }

    printFactorHistoryRows("7-year-BLS-trimmed", removeOutliersAndRecalculate(7, "7-year-BLS-trimmed", fullYearFactors));
    printFactorHistoryRows("10-year-BLS-trimmed", removeOutliersAndRecalculate(10, "10-year-BLS-trimmed", fullYearFactors));
    printFactorHistoryRows("20-year-BLS-trimmed", removeOutliersAndRecalculate(20, "20-year-BLS-trimmed", fullYearFactors));
    printFactorHistoryRows("30-year-BLS-trimmed", removeOutliersAndRecalculate(30, "30-year-BLS-trimmed", fullYearFactors));

    function evaluateDataset(label, years, trimOutliers) {
        const errors = [];
        const firstYear = fullYearFactors[0].year;

        for (let targetYear = firstYear + years; targetYear <= lastFullYear; targetYear++) {
            const sourceFactors = fullYearFactors.filter(r => r.year >= targetYear - years && r.year < targetYear);
            const dataset = buildMonthFactorMap(sourceFactors, trimOutliers);
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
        const { average, weightedAverage } = createErrorStatsHelpers(recentStartYear);

        for (let originYear = recentForecastOriginStart; originYear <= recentForecastOriginEnd; originYear++) {
            const sourceFactors = fullYearFactors.filter(r =>
                r.year >= originYear - years + 1 && r.year <= originYear);
            const dataset = buildMonthFactorMap(sourceFactors, trimOutliers);

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

    function evaluateMovingAverageWindowDataset(label, startDate, endDate) {
        const sourceMonths = getMonthsInWindow(allFactors, startDate, endDate);

        if (sourceMonths.length === 0) {
            console.error(`Error: ${label} requested window ${startDate} through ${endDate} returned no data.`);
            process.exit(1);
        }

        const dataset = buildMonthFactorMap(sourceMonths, false);
        const errors = [];

        const predictedMean = Array.from(dataset.values()).reduce((sum, row) => sum + row, 0) / dataset.size;
        const actualMean = sourceMonths.reduce((sum, row) => sum + row.factor, 0) / sourceMonths.length;

        for (const actual of sourceMonths) {
            const adjustedMonth = ((actual.month + 3 - 1) % 12) + 1;
            const predicted = dataset.get(adjustedMonth);
            if (predicted === undefined) continue;
            const error = predicted - actual.factor;
            const shapeError = (predicted / predictedMean) - (actual.factor / actualMean);
            errors.push({
                year: actual.year,
                error,
                absoluteError: Math.abs(error),
                squaredError: error ** 2,
                absolutePctError: Math.abs(error / actual.factor) * 100,
                shapeAbsoluteError: Math.abs(shapeError),
                shapeSquaredError: shapeError ** 2,
            });
        }

        const { average, weightedAverage } = createErrorStatsHelpers();

        return {
            label,
            years: null,
            trimOutliers: false,
            monthsCompared: errors.length,
            overallMae: average(errors, r => r.absoluteError),
            recent10Mae: null,
            weightedMae: weightedAverage(errors, r => r.absoluteError),
            overallShapeMae: average(errors, r => r.shapeAbsoluteError),
            weightedShapeMae: weightedAverage(errors, r => r.shapeAbsoluteError),
            commonPeriodMonthsCompared: errors.length,
            commonPeriodWeightedShapeMae: weightedAverage(errors, r => r.shapeAbsoluteError),
            recent10YearForecastMonthsCompared: errors.length,
            recent10YearForecastShapeMae: average(errors, r => r.shapeAbsoluteError),
            overallRmse: average(errors, r => r.squaredError) === null ? null
                : Math.sqrt(average(errors, r => r.squaredError)),
            recent10Rmse: null,
            meanBias: average(errors, r => r.error),
            weightedMeanAbsPct: weightedAverage(errors, r => r.absolutePctError),
            isMovingAverageWindow: true,
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

    const standardDatasetAnalysis = datasetsToEvaluate
        .map(dataset => evaluateDataset(dataset.label, dataset.years, dataset.trimOutliers))
        .sort((a, b) => (b.recent10YearForecastShapeMae ?? -Infinity)
            - (a.recent10YearForecastShapeMae ?? -Infinity));

    const movingAverageDatasetAnalysis = movingAverageWindowDatasets
        .map(dataset => evaluateMovingAverageWindowDataset(dataset.label, dataset.startDate, dataset.endDate));

    const datasetAnalysis = [...standardDatasetAnalysis, ...movingAverageDatasetAnalysis]
        .sort((a, b) => (b.recent10YearForecastShapeMae ?? -Infinity)
            - (a.recent10YearForecastShapeMae ?? -Infinity));

    const formatAnalysisValue = value => value === null ? "NA" : roundToFixed(value, 5, 6);

    function printDatasetAnalysis(datasetAnalysis) {
        console.log(",dataset,years,trimOutliers,monthsCompared,overallMae,recent10Mae,weightedMae,overallShapeMae,weightedShapeMae,commonPeriodMonthsCompared,commonPeriodWeightedShapeMae,recent10YearForecastMonthsCompared,recent10YearForecastShapeMae,overallRmse,recent10Rmse,meanBias,weightedMeanAbsPct");
        const rankedDatasets = datasetAnalysis.filter(result => result.recent10YearForecastShapeMae !== null);

        for (const result of rankedDatasets) {
            console.log([
                "",
                result.label,
                result.years ?? "moving-average",
                result.trimOutliers ?? "",
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
    }

    printDatasetAnalysis(datasetAnalysis);

    const bestDataset = datasetAnalysis.reduce((best, result) =>
        result.recent10YearForecastShapeMae < best.recent10YearForecastShapeMae ? result : best
    );

    console.log(`,best recent 10-year forecast shape dataset (BLS + moving-average datasets),${bestDataset.label}`);

    return { datasetAnalysis, bestDataset };
}
