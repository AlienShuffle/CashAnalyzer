import {
    duDaysBetween,
    duGetDateFromYYYYMMDD
} from '../lib/dateUtils.mjs';
import { roundTo, roundToFixed } from "../lib/utils.mjs";

// start in 1996 as that is the year before TIPS were introduced.
const series = "CPIAUCNS";
const startDate = "1996-01-01";
const response = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${startDate}&coed=9999-12-31`);
const csvText = await response.text();
const monthsText = csvText.split("\n"); 0

if (monthsText.length <= 100) {
    console.error("Error: Not enough data points retrieved. probaby intermittent issue.");
    process.exit(1);
}

// seed with the missing month due to 2025 Govt shutdown, then loop through the rest of the months and build the response for each month.
let months = [{
    month: "2025-10-01",
    CPI: 325.604
}];
for (let i = 1; i < monthsText.length; i++) {
    const row = monthsText[i].split(",");
    const month = row[0];
    const CPI = row[1] * 1;
    if (isNaN(CPI) || CPI === 0) continue; // skip rows with missing CPI values
    months.push({
        month: month,
        CPI: CPI,
    });
}
months.sort((a, b) => new Date(a.month) - new Date(b.month)); // sort by month to get shutdown month in correct order

let resp = [];
for (let i = 0; i < months.length - 1; i++) {
    const month = months[i].month;
    const nextMonth = months[i + 1].month;
    const refCPI = months[i].CPI;
    const nextRefCPI = months[i + 1].CPI;

    // add 3 months to get the TIPS month that the CPI value applies to, as REFCPI is calculated with a 3 month lag. 
    const refCpiMonth = duGetDateFromYYYYMMDD(month);
    refCpiMonth.setMonth(refCpiMonth.getMonth() + 3);
    const nextRefCpiMonth = duGetDateFromYYYYMMDD(nextMonth);
    nextRefCpiMonth.setMonth(nextRefCpiMonth.getMonth() + 3);

    const monthDays = duDaysBetween(refCpiMonth, nextRefCpiMonth);
    const dailyCPIIncrement = roundTo((nextRefCPI - refCPI) / monthDays, 6);

    for (let j = 0; j < monthDays; j++) {
        const dailyCPIDate = new Date(refCpiMonth);
        dailyCPIDate.setDate(dailyCPIDate.getDate() + j);
        resp.push({
            refCPIDate: dailyCPIDate.toISOString().substring(0, 10),
            refCPI: refCPI + dailyCPIIncrement * j,
        });
    }
}
// add first day of last month with the last month's CPI value, as that is the last day that the last month's CPI value applies to.
const lastDate = duGetDateFromYYYYMMDD(months[months.length - 1].month);
lastDate.setMonth(lastDate.getMonth() + 3);
resp.push({
    refCPIDate: lastDate.toISOString().substring(0, 10),
    refCPI: months[months.length - 1].CPI,
});
// output the .csv content for use in REFCPI.csv
console.log(`date,REFCPI`);
for (let i = 0; i < resp.length; i++) {
    const r = resp[i];
    console.log(`${r.refCPIDate},${roundToFixed(r.refCPI, 5, 6)}`);
}