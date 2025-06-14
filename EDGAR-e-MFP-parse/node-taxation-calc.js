import { duGetDateFromYYYYMMDD } from "../lib/dateUtils.mjs";
import { readFileSync } from 'fs';
import dynamicSort from '../lib/dynamicSort.mjs'
import process from 'node:process';

const debug = false;

// read in the MFP XML file from stdin.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);

if (json.length == 0) process.exit(1);

// meta data that is the same in all records in one file.
const ticker = json[0].ticker;
const fiscalYearEnd = json[0].fiscalYearEnd;
if (!fiscalYearEnd) console.error(`${ticker}: no Fiscal Year Reported!`)

// manage the main year objects as they are sparse and need setup.
let years = [];
function findYearObj(year, createNew = true) {
    let yearIndex = -1;
    for (let y = 0; y < years.length; y++) {
        if (years[y].year == year) {
            yearIndex = y;
            break;
        }
    }
    if (yearIndex < 0) {
        if (!createNew)
            return "";
        years.push({
            ticker: ticker,
            year: year,
            months: 0,
            assets: 0,
            usgo: 0,
            muni: 0,
            qOnePct: -1,
            qTwoPct: -1,
            qThreePct: -1,
            qFourPct: -1
        });
        yearIndex = years.length - 1;
    }
    return yearIndex;
}


// fiscal year calendar for the fund, find the months for the 4 qtr ends.
if (debug) console.log(fiscalYearEnd);
const qFourMonth = (fiscalYearEnd) ? fiscalYearEnd.substring(0, 2) * 1 : 12;
const qThreeMonth = (fiscalYearEnd) ? (qFourMonth + 9) % 12 : 9;
const qTwoMonth = (fiscalYearEnd) ? (qThreeMonth + 9) % 12 : 6;
const qOneMonth = (fiscalYearEnd) ? (qTwoMonth + 9) % 12 : 3;
const firstQuarterInCalendarYear = (qFourMonth <= 3) ? 4 : ((qThreeMonth <= 3) ? 3 : ((qTwoMonth <= 3) ? 2 : ((qOneMonth <= 3) ? 1 : 0)));
if (debug) console.log(`${qOneMonth}, ${qTwoMonth}, ${qThreeMonth}, ${qFourMonth}`);
if (debug) console.log(`firstQuarterInCalendarYear=${firstQuarterInCalendarYear}`);

// loop through each monthly EDGAR report.
for (let i = json.length - 1; i >= 0; i--) {
    const report = json[i];
    const reportDate = duGetDateFromYYYYMMDD(report.reportDate);
    const month = reportDate.getMonth() + 1;
    const year = reportDate.getFullYear();
    const totalAssets = report.totalNetAssets;
    const usgo = report.USGO;
    const muni = report.Muni;

    const thisYear = findYearObj(year);
    years[thisYear].months++;
    years[thisYear].assets += totalAssets;
    years[thisYear].usgo += usgo * totalAssets;
    years[thisYear].muni += muni * totalAssets;

    if (debug) console.log(`month = ${month}`);
    if (month == qOneMonth) years[thisYear].qOnePct = usgo;
    if (month == qTwoMonth) years[thisYear].qTwoPct = usgo;
    if (month == qThreeMonth) years[thisYear].qThreePct = usgo;
    if (month == qFourMonth) years[thisYear].qFourPct = usgo;
}
years.sort(dynamicSort('year'));
// loop through the year reports and calculate the fifty percent rule results.
for (let i = 0; i < years.length; i++) {
    if (debug) console.log(`year=${years[i].year}`);
    const twelveMosAssets = years[i].assets;
    years[i].usgo /= twelveMosAssets;
    years[i].muni /= twelveMosAssets;
    years[i].assets /= years[i].months;
    years[i].estimateType = (years[i].months == 12) ? "complete" : "YTD";

    // I am interpreting the 50 percent rule for CA/NY/CT very conservatively. It says if any quarter in the fiscal year
    // ends with USGO assets less than 50%, it is not qualified. I assume they any quarters in the more recently completed
    // fiscal year count, and just to be safe, any quarters in the current calendar year. T
    const thisYear = findYearObj(years[i].year, false);
    const lastYear = findYearObj(years[i].year - 1, false);
    years[i].fiftyPctRule = true;
    years[i].fiftyPctHistory = (fiscalYearEnd) ? 'complete' : 'missing fiscal year';
    if (lastYear) {
        if (years[i].months == 12) {
            // full year, use the most recent complete fiscal year, and also current calendar year.
            if (years[(firstQuarterInCalendarYear > 1) ? lastYear : thisYear].qOnePct < .5) years[i].fiftyPctRule = false;
            if (years[(firstQuarterInCalendarYear > 2) ? lastYear : thisYear].qTwoPct < .5) years[i].fiftyPctRule = false;
            if (years[(firstQuarterInCalendarYear > 3) ? lastYear : thisYear].qThreePct < .5) years[i].fiftyPctRule = false;
            if (years[(firstQuarterInCalendarYear > 4) ? lastYear : thisYear].qFourPct < .5) years[i].fiftyPctRule = false;

            if (years[(firstQuarterInCalendarYear > 1) ? lastYear : thisYear].qOnePct < 0) years[i].fiftyPctHistory = "incomplete";
            if (years[(firstQuarterInCalendarYear > 2) ? lastYear : thisYear].qTwoPct < 0) years[i].fiftyPctHistory = "incomplete";
            if (years[(firstQuarterInCalendarYear > 3) ? lastYear : thisYear].qThreePct < 0) years[i].fiftyPctHistory = "incomplete";
            if (years[(firstQuarterInCalendarYear > 4) ? lastYear : thisYear].qFourPct < 0) years[i].fiftyPctHistory = "incomplete";
            // current year.
            if (years[thisYear].qOnePct < .5 || years[thisYear].qTwoPct < .5 || years[thisYear].qThreePct < .5) years[i].fiftyPctRule = false;
        } else {
            // in process year, need an alternative process. Will use the last four quarters on the run not lined up with the fiscal year.
            years[i].fiftyPctHistory = "current-year";
            const month = years[i].months;
            if (years[(month >= qOneMonth) ? thisYear : lastYear].qOnePct < .5) years[i].fiftyPctRule = false;
            if (years[(month >= qTwoMonth) ? thisYear : lastYear].qTwoPct < .5) years[i].fiftyPctRule = false;
            if (years[(month >= qThreeMonth) ? thisYear : lastYear].qThreePct < .5) years[i].fiftyPctRule = false;
            if (years[(month >= qFourMonth) ? thisYear : lastYear].qFourPct < .5) years[i].fiftyPctRule = false;
        }
    } else {
        // no data for last year, so if 4th quarter does not end on 12/31, then incomplete.
        if (qFourMonth != 12) {
            years[i].fiftyPctRule = false;
            years[i].fiftyPctHistory = "incomplete";
        }
    }
}
console.log(JSON.stringify(years));
if (debug) console.log(JSON.stringify(json));
process.exit(0);