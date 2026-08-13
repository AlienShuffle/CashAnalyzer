import {
    duDateLessThan,
    duGetDateFromYYYYMMDD
} from '../lib/dateUtils.mjs';

const response = await fetch(`https://alfred.stlouisfed.org/release/downloaddates?rid=10&ff=txt`);
const rawText = await response.text();
// remove preamble text and header row, leaving only the data rows
const srchString = "Release Dates:\n----------\n";
const startIndex = rawText.indexOf(srchString);
if (startIndex === -1) {
    console.error("Error: Could not find data in the response.");
    process.exit(1);
}
// remove final '----------' line and any trailing whitespace
const endIndex = rawText.lastIndexOf("----------");
if (endIndex === -1) {
    console.error("Error: Could not find end of data in the response.");
    process.exit(1);
}
const dataText = rawText.substring(startIndex + srchString.length, endIndex).trim();
const monthsText = dataText.split("\n"); // exclude the preamble and header row
//console.log(`Retrieved ${monthsText.length} data points.`);

if (monthsText.length <= 100) {
    console.error("Error: Not enough data points retrieved. probaby intermittent issue.");
    process.exit(1);
}

const startDate = duGetDateFromYYYYMMDD("1996-01-01");
let results = [];
for (let i = 0; i < monthsText.length; i++) {
    const line = monthsText[i].trim();
    if (line.length === 0) {
        continue; // skip empty lines
    }
    const rlsDate = duGetDateFromYYYYMMDD(line);
    const rlsDateStr = rlsDate.toISOString().substring(0, 10); // format as YYYY-MM-DD
    const cpiDate = new Date(rlsDate.getFullYear(), rlsDate.getMonth() - 1, 1); // first day of previous month

    if (duDateLessThan(cpiDate, startDate)) continue; // skip dates before startDate

    const cpiDateStr = cpiDate.toISOString().substring(0, 10); // format as YYYY-MM-DD
    const refcpiDate = new Date(cpiDate.getFullYear(), cpiDate.getMonth() + 3, 1); // first day of month before cpiDate
    const refcpiDateStr = refcpiDate.toISOString().substring(0, 10);
    results.push({ rlsDate: rlsDateStr, cpiDate: cpiDateStr, refcpiDate: refcpiDateStr });
}
// dump the list of dates.
console.log(JSON.stringify(results));