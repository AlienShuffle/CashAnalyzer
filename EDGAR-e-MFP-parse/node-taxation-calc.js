import { duGetDateFromYYYYMMDD } from "../lib/dateUtils.mjs";
import { readFileSync } from 'fs';
import dynamicSort from '../lib/dynamicSort.mjs'
import process from 'node:process';
import { time } from "node:console";

const debug = false;    // turn on for more logging.

// read in the MFP XML file from stdin.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);

if (json.length == 0) process.exit(1);

// meta data that is the same in all records in one file.
const timestamp = new Date;
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
            q1Pct: -1,
            q2Pct: -1,
            q3Pct: -1,
            q4Pct: -1,
            timestamp: timestamp
        });
        yearIndex = years.length - 1;
    }
    return yearIndex;
}

// fiscal year calendar for the fund, find the months for the 4 qtr ends.
// if fiscal year is missing from the EDGAR file, fall back to calendar year.
if (debug) console.error(fiscalYearEnd);
let qMonths = [];
qMonths[4] = (fiscalYearEnd) ? fiscalYearEnd.substring(0, 2) * 1 : 12;
qMonths[3] = (qMonths[4] + 9) % 12;
if (qMonths[3] == 0) qMonths[3] = 12;
qMonths[2] = (qMonths[3] + 9) % 12;
if (qMonths[2] == 0) qMonths[2] = 12;
qMonths[1] = (qMonths[2] + 9) % 12;
if (qMonths[1] == 0) qMonths[1] = 12;
const firstQuarterInNextCalendarYear = (qMonths[4] <= 3) ? 4
    : ((qMonths[3] <= 3) ? 3
        : ((qMonths[2] <= 3) ? 2
            : ((qMonths[1] < 3) ? 1 : 0)
        )
    );
if (debug) console.error(`${qMonths[1]}, ${qMonths[2]}, ${qMonths[3]}, ${qMonths[4]}`);
if (debug) console.error(`firstQuarterInCalendarYear=${firstQuarterInNextCalendarYear}`);

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

    const whichYear = (month <= qMonths[4]) ? thisYear : findYearObj(year + 1);
    if (debug) console.error(`month = ${month}, whichYear=${years[whichYear].year}`);

    // align the fiscal year quarters into the calendar year the fiscal year ends in.
    // this keeps final comparisons below all in the "current" year view.
    if (month == qMonths[1]) years[whichYear].q1Pct = usgo;
    if (month == qMonths[2]) years[whichYear].q2Pct = usgo;
    if (month == qMonths[3]) years[whichYear].q3Pct = usgo;
    if (month == qMonths[4]) years[whichYear].q4Pct = usgo;
}
years.sort(dynamicSort('year'));
// loop through the year reports and calculate the fifty percent rule results.
for (let i = 0; i < years.length; i++) {
    const year = years[i].year;
    if (debug) console.error(`year=${year}`);
    const twelveMosAssets = years[i].assets;

    years[i].fiscalYearEnd = fiscalYearEnd;
    years[i].usgo = (years[i].usgo / twelveMosAssets).toFixed(5) * 1;
    years[i].muni = (years[i].muni / twelveMosAssets).toFixed(5) * 1;
    years[i].assets = (years[i].assets / years[i].months).toFixed(2) * 1;
    years[i].estimateType = (years[i].months == 12) ? "complete" : "YTD";

    // I am interpreting the 50 percent rule for CA/NY/CT very conservatively. It says if any quarter in the fiscal year
    // ends with USGO assets less than 50%, it is not qualified. I assume that any quarters in the most recently completed
    // fiscal year count, and just to be safe, any quarters in the current calendar year also.
    const thisYear = findYearObj(year);
    years[i].fiftyPctRule = true;
    years[i].fiftyPctHistory = (fiscalYearEnd) ? 'complete' : 'missing fiscal year';
    if (years[i].months == 12) {
        // Full year, use the most recent complete fiscal year, and also current calendar year.
        const q1Pct = years[i].q1Pct;
        const q2Pct = years[i].q2Pct;
        const q3Pct = years[i].q3Pct;
        const q4Pct = years[i].q4Pct;
        // Check each fiscal quarter for 50% rule.
        if ((q1Pct >= 0 && q1Pct < .5) ||
            (q2Pct >= 0 && q2Pct < .5) ||
            (q3Pct >= 0 && q3Pct < .5) ||
            (q4Pct >= 0 && q4Pct < .5)) {
            years[i].fiftyPctRule = false;
        }
        // Check if any fiscal quarter data is missing.
        if (q1Pct < 0 || q2Pct < 0 || q3Pct < 0 || q4Pct < 0) {
            years[i].fiftyPctHistory = "incomplete";
        }
        // The 4 quarters during the current calendar year, by my reading must also be checked.
        // Note, the law is unclear if one of these rules apply or both, I am applying both to be conservative.
        // I am open to correction.
        // See: https://codes.findlaw.com/ca/revenue-and-taxation-code/rtc-sect-17145/
        const nextYear = findYearObj(year + 1);
        if (firstQuarterInNextCalendarYear < 1 && years[nextYear].q1Pct >= 0 && years[nextYear].q1Pct < .5) years[i].fiftyPctRule = false;
        if (firstQuarterInNextCalendarYear < 2 && years[nextYear].q2Pct >= 0 && years[nextYear].q2Pct < .5) years[i].fiftyPctRule = false;
        if (firstQuarterInNextCalendarYear < 3 && years[nextYear].q3Pct >= 0 && years[nextYear].q3Pct < .5) years[i].fiftyPctRule = false;
        if (firstQuarterInNextCalendarYear < 4 && years[nextYear].q4Pct >= 0 && years[nextYear].q4Pct < .5) years[i].fiftyPctRule = false;
    } else {
        // in process year, need an alternative process. Will use the last four quarters on the run lined up with the fiscal year quarters.
        const month = years[i].months;
        const lastYear = findYearObj(year - 1, false);
        years[i].fiftyPctHistory = (lastYear && years[lastYear].months == 12) ? "current-year" : "incomplete";

        const q1Pct = (month >= qMonths[1]) ? years[thisYear].q1Pct : ((lastYear) ? years[thisYear].q1Pct : -1);
        const q2Pct = (month >= qMonths[2]) ? years[thisYear].q2Pct : ((lastYear) ? years[thisYear].q2Pct : -1);
        const q3Pct = (month >= qMonths[3]) ? years[thisYear].q3Pct : ((lastYear) ? years[thisYear].q3Pct : -1);
        const q4Pct = (month >= qMonths[4]) ? years[thisYear].q4Pct : ((lastYear) ? years[thisYear].q4Pct : -1);

        if ((q1Pct >= 0 && q1Pct < .5) ||
            (q2Pct >= 0 && q2Pct < .5) ||
            (q3Pct >= 0 && q3Pct < .5) ||
            (q4Pct >= 0 && q4Pct < .5) ||
            (q1Pct < 0 && q2Pct < 0 && q3Pct < 0 && q4Pct < 0)
        ) {
            years[i].fiftyPctRule = false;
        }
    }
}
years.sort(dynamicSort('year'));
// insert placeholder a year with fiscal quarters only and no asset reports in January, otherwise remove empty years.
const tsYear = timestamp.getFullYear();
let tsYearFound = false;
for (let i = 0; i < years.length; i++) {
    const year = years[i].year;
    if (!years[i].assets) {
        if (debug) console.error(`empty assets in year=${year}`);
        if (tsYear == year) {
            if (debug) console.error(` ${tsYear}=${year}`);
            Object.assign(years[i], years[i - 1]);
            years[i].year = year;
            years[i].estimateType = "new-year-placeholder";
            delete years[i].assets;
        } else {
            years.splice(i, 1);
        }
    } else {
        delete years[i].assets;
    }
    if (!tsYearFound){
        if (debug) console.error(`tsYear ${year} not found, creating placeholder`);
        let obj = {};
        Object.assign(obj, years[years.length - 1]);
        obj.year = tsYear;
        obj.estimateType = "new-year-placeholder";
        years.push(obj);
        tsYearFound = true;
    }
}
console.log(JSON.stringify(years));
process.exit(0);