import {
    duDaysBetween,
    duGetDateFromYYYYMMDD,
    duDateLessThan
} from '../lib/dateUtils.mjs';
import { roundToFixed } from "../lib/utils.mjs";
import { fetchCpiDates } from "../lib/cpiDatesUtils.mjs";
import { fetchFredCpiMonths } from "../lib/fredCpiUtils.mjs";

const saMonths = await fetchFredCpiMonths("CPIAUCSL", { attr: "CPISA", startDateString: "2019-01-01" }); // Seasonally adjusted.
const nsaMonths = await fetchFredCpiMonths("CPIAUCNS", { attr: "CPINSA", startDateString: "2019-01-01" }); // Not seasonally adjusted.

// grep CPI release months.
const cpiDates = await fetchCpiDates();

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

// build the response for each month; October 2025 (govt shutdown gap) is filled in by fetchFredCpiMonths.
let months = [];
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
        resp.push({
            refCPIDate: dailyCPIDate.toISOString().substring(0, 10),
            refCPINSA: refCPINSA + dailyCPINSAIncrement * j,
            refCPISA: refCPISA + dailyCPISAIncrement * j,
            SAFactor: (refCPINSA + dailyCPINSAIncrement * j) / (refCPISA + dailyCPISAIncrement * j),
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
    SAFactor: months[months.length - 1].CPINSA / months[months.length - 1].CPISA,
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