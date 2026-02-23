import { readFileSync } from "fs";

function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

// strip facts only data and output in rates.json file format on stdout.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let i = 0; i < json.length; i++) {
    const item = json[i];
    if (!item.ticker) continue;
    let row = { "ticker": item.ticker };
    if (safeObjectRef(item.accountType)) row.accountType = item.accountType;
    if (safeObjectRef(item.nav)) row.nav = item.nav;
    if (safeObjectRef(item.oneDayYield)) row.oneDayYield = item.oneDayYield;
    if (safeObjectRef(item.sevenDayYield)) row.sevenDayYield = item.sevenDayYield;
    if (safeObjectRef(item.thirtyDayYield)) row.thirtyDayYield = item.thirtyDayYield;
    if (safeObjectRef(item.asOfDate)) row.asOfDate = item.asOfDate;
    if (safeObjectRef(item.source)) row.source = item.source;
    row.timestamp = new Date();
    resp.push(row);
}
console.log(JSON.stringify(resp));