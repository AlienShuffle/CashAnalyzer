import {
    duDateLessThan,
    duGetDateDelta,
    duGetDateFromYYYYMMDD,
    duGetISOString
} from "../lib/dateUtils.mjs";

// pull in a CPI metric and create a metric array.
async function getCPIMonths(metric) {
    const startDate = new Date(1996, 0, 1);
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
let months = [];
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
    months.push({
        fullDate: slMonths[i].fullDate,
        year: year,
        month: month,
        CPINS: nsCPI,
        CPISL: slCPI,
        factor: (100 * nsCPI / slCPI).toFixed(4) * 1,
    });
}
// remove last partial year from months.
for (let i = months.length - 1; i >= 0; i--) {
    if (months[i].year > lastFullYear) {
        months.splice(i, 1);
    } else {
        break;
    }
}
//console.error(`last full year: ${lastFullYear}`);
//console.error(`Retrieved ${months.length} months of CPI data, starting with ${months[0].fullDate} and ending with ${months[months.length - 1].fullDate}.`);
//console.error(JSON.stringify(months, null, 2));

// create an n-year factor history, starting with the most recent month, and including the previous n-1 months.
// The factor is calculated as the ratio of NS to SA CPI values, multiplied by 100.
// The daily delta is calculated as the difference between the current month's factor and the next month's factor,
// divided by the number of days in the month.
// The factor on the 15th of the month is calculated as the current month's factor plus the daily delta times 14.
function calcFactorHistory(years, type) {
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
            const avgFactor = (factorGroups[i].reduce((sum, r) => sum + r.factor, 0) / factorGroups[i].length).toFixed(4) * 1;
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
    const totalFactor = historicalFactors.reduce((sum, r) => sum + r.factor, 0);
    const adjustmentRatio = 1200 / totalFactor;
    for (let i = 0; i < historicalFactors.length; i++) {
        historicalFactors[i].factor = (historicalFactors[i].factor * adjustmentRatio).toFixed(4) * 1;
    }

    // calculate the daily delta and factor on the 15th of the month for each month, using the next month's factor as the end factor.
    // also output the results to the console in CSV format.
    for (let i = 0; i < historicalFactors.length; i++) {
        const r = historicalFactors[i];
        const sfactor = r.factor;
        const nextFactor = historicalFactors[(i + 1) % historicalFactors.length];
        const efactor = nextFactor.factor;
        const dim = new Date(new Date().getFullYear(), r.month, 0).getDate();
        const dailyDelta = ((efactor - sfactor) / dim).toFixed(4) * 1;
        const factor15th = (sfactor + dailyDelta * 14).toFixed(4) * 1;
        historicalFactors[i].dim = dim;
        historicalFactors[i].dailyDelta = dailyDelta;
        historicalFactors[i].factor15th = factor15th;
        historicalFactors[i].factorYear = new Date().getFullYear();
        historicalFactors[i].startDate = r.calcStart;
        historicalFactors[i].endDate = r.calcEnd;
        console.log(`${r.type},${r.month},${r.factor15th},${r.factor},${r.dailyDelta},${r.factorYear},${r.startDate},${r.endDate},${r.entriesTested}`);
    }
    //console.log(JSON.stringify(historicalFactors, null, 2));  
}

console.log(`type,month,factor15th,factor,dailyDelta,factorYear,startDate,endDate,entriesTested`);
calcFactorHistory(1, "1-year");
calcFactorHistory(2, "2-year");
calcFactorHistory(5, "5-year");
calcFactorHistory(10, "10-year");
calcFactorHistory(20, "20-year");