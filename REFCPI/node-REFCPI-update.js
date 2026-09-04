import {
    duDaysBetween,
    duGetDateFromYYYYMMDD,
    duDateLessThan
} from '../lib/dateUtils.mjs';
import { roundTo, roundToFixed } from "../lib/utils.mjs";

// pull in a CPI metric and create a metric array.
/**
 * 
 * @param {string} series CPI series to pull from FRED. e.g. CPIAUCSL for seasonally adjusted, CPIAUCNS for not seasonally adjusted.
 * @param {string} attr json attribute name to use for the CPI value in the returned array. 
 * @returns 
 */
async function getCPIMonths(series, attr) {
    const startDateString = "1996-01-01";
    const startDate = duGetDateFromYYYYMMDD(startDateString); // validate startDate
    const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${startDateString}&coed=9999-12-31`);
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
            [attr]: CPI,
        });
    }
    if (filtered.length <= 50) {
        console.error(`Error: ${series}, Not enough data points retrieved. probaby intermittent issue.`);
        process.exit(1);
    }
    return filtered;
}
const saMonths = await getCPIMonths("CPIAUCSL", "CPISA"); // Seasonally adjusted.
const nsaMonths = await getCPIMonths("CPIAUCNS", "CPINSA"); // Not seasonally adjusted.

// grep CPI release months.
const cpiDatesStr = await fetch('https://cashoptimizer.pages.dev/Treasuries/CPI-dates.json');
const cpiDatesText = await cpiDatesStr.text();
const cpiDates = JSON.parse(cpiDatesText);
cpiDates.sort((a, b) => new Date(a.rlsDate) - new Date(b.rlsDate));

// function to find the latest CPI release date (rlsDate) that is less than or equal to the given date (date), return the corresponding refcpiDate.
function findCPIReleaseDate(date) {
    for (let i = cpiDates.length - 1; i >= 0; i--) {
        const rlsDate = duGetDateFromYYYYMMDD(cpiDates[i].rlsDate);
        // Find the latest release that is not later than the requested date.
        if (!duDateLessThan(date, rlsDate)) {
            // console.error(`DEBUG[${i}]: ${date.toISOString().substring(0, 10)}:${rlsDate}`);
            return duGetDateFromYYYYMMDD(cpiDates[i].refcpiDate);
        }
    }
    return null;
}

// seed with the missing month due to 2025 Govt shutdown, then loop through the rest of the months and build the response for each month.
let months = [{
    year: 2025,
    month: 10,
    date: "2025-10-01",
    CPINSA: 325.604,
    CPISA: 325.551
}];
for (let i = 0; i < saMonths.length; i++) {
    const saRow = saMonths[i];
    if (isNaN(saRow.CPISA) || saRow.CPISA === 0) continue; // skip rows with missing CPI values
    const nsaRow = nsaMonths.find(nsa => nsa.year === saRow.year && nsa.month === saRow.month);
    if (!nsaRow) continue; // skip rows with missing NSA CPI values
    if (isNaN(nsaRow.CPINSA) || nsaRow.CPINSA === 0) continue; // skip rows with missing CPI values

    months.push({
        year: saRow.year,
        month: saRow.month,
        date: saRow.fullDate,
        CPINSA: nsaRow.CPINSA,
        CPISA: saRow.CPISA,
    });
}
// sort forward by month to get shutdown month in correct order.
months.sort((a, b) => new Date(a.date) - new Date(b.date));

function formatMMDD(d) {
    return ('M' + (d.getMonth() + 1).toString().padStart(2, '0') + d.getDate().toString().padStart(2, '0'));
}
// Now convert to daily values and add a Seasonal Factor column to the output.
// The Seasonal Factor is the ratio of the NSA CPI to the SA CPI for each month.
let resp = [];
for (let i = 0; i < months.length - 1; i++) {
    const month = months[i].date;
    const nextMonth = months[i + 1].date;

    // add 3 months to get the TIPS month that the CPI value applies to, as REFCPI is calculated with a 3 month lag. 
    const refCpiMonth = duGetDateFromYYYYMMDD(month);
    refCpiMonth.setMonth(refCpiMonth.getMonth() + 3);
    const nextRefCpiMonth = duGetDateFromYYYYMMDD(nextMonth);
    nextRefCpiMonth.setMonth(nextRefCpiMonth.getMonth() + 3);
    const monthDays = duDaysBetween(refCpiMonth, nextRefCpiMonth);

    // this block calculates dail NSA REFCPI values.
    const refCPINSA = months[i].CPINSA;
    const nextRefCPINSA = months[i + 1].CPINSA;
    const dailyCPINSAIncrement = (nextRefCPINSA - refCPINSA) / monthDays;

    // this block calculates dail SA REFCPI values.
    const refCPISA = months[i].CPISA;
    const nextRefCPISA = months[i + 1].CPISA;
    const dailyCPISAIncrement = (nextRefCPISA - refCPISA) / monthDays;

    for (let j = 0; j < monthDays; j++) {
        const dailyCPIDate = new Date(refCpiMonth);
        dailyCPIDate.setDate(dailyCPIDate.getDate() + j);
        const maxREFCPI = findCPIReleaseDate(dailyCPIDate);
        // console.error(`DEBUG: ${dailyCPIDate.toISOString().substring(0, 10)}: refCPINSA=${refCPINSA + dailyCPINSAIncrement * j}, refCPISA=${refCPISA + dailyCPISAIncrement * j}, SAFactor=${roundTo((refCPINSA + dailyCPINSAIncrement * j) / (refCPISA + dailyCPISAIncrement * j), 6)}, maxREFCPI=${maxREFCPI ? maxREFCPI.toISOString().substring(0, 10) : 'null'}`);
        resp.push({
            refCPIDate: dailyCPIDate.toISOString().substring(0, 10),
            refCPINSA: refCPINSA + dailyCPINSAIncrement * j,
            refCPISA: refCPISA + dailyCPISAIncrement * j,
            SAFactor: roundTo((refCPINSA + dailyCPINSAIncrement * j) / (refCPISA + dailyCPISAIncrement * j), 6),
            mmdd: formatMMDD(dailyCPIDate),
            maxREFCPI: maxREFCPI.toISOString().substring(0, 10)
        });
    }
}
// add first day of last month with the last month's CPI value, as that is the last day that the last month's CPI value applies to.
const lastDate = duGetDateFromYYYYMMDD(months[months.length - 1].date);
lastDate.setMonth(lastDate.getMonth() + 3);
resp.push({
    refCPIDate: lastDate.toISOString().substring(0, 10),
    refCPINSA: months[months.length - 1].CPINSA,
    refCPISA: months[months.length - 1].CPISA,
    SAFactor: roundTo(months[months.length - 1].CPINSA / months[months.length - 1].CPISA, 6),
    mmdd: formatMMDD(lastDate),
    maxREFCPI: lastDate.toISOString().substring(0, 10)
});

// reverse sort by month to get shutdown month in correct order for SA Factor lookup (latest is best).
resp.sort((a, b) => new Date(b.refCPIDate) - new Date(a.refCPIDate));
// output the .csv content for use in REFCPI.csv
console.log('Date,REFCPINSA,REFCPISA,SAFactor,MMDD,maxREFCPI');
for (let i = 0; i < resp.length; i++) {
    const r = resp[i];
    console.log(`${r.refCPIDate},${roundToFixed(r.refCPINSA, 5, 6)},${roundToFixed(r.refCPISA, 5, 6)},${roundToFixed(r.SAFactor, 5, 6)},${r.mmdd},${r.maxREFCPI}`);
}