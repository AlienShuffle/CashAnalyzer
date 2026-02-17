import { duGetISOString } from "../lib/dateUtils.mjs";
import { readFileSync } from "fs";

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read in from stdin, the BlackRock json file.
const stdinBuffer = readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
//console.log(`json.length = ${json.length}`);

const timestamp = new Date();
let resp = [];
let count = 0;
// go through each ticker report provided, not structured as an array, instead a set of keys in a single object.
for (let key in json) {
    const fund = json[key];
    const ticker = fund.localExchangeTicker;
    if (!ticker) continue;

    const sevenDayYield = safeObjectRef(fund.oneWeekSecYield.r);
    if (sevenDayYield) {
        let rowData = {};
        const dateInt = fund.oneWeekSecYieldAsOf.r;
        const year = Math.trunc(dateInt / 10000);
        const month = Math.trunc((dateInt % 10000) / 100);
        const day = Math.trunc(dateInt % 100);
        //console.error(`${ticker}: dateInt = ${dateInt} -> year = ${year}, month = ${month}, day = ${day}`);
        rowData.asOfDate = duGetISOString(new Date(year, month - 1, day));
        rowData.price = 1;
        rowData.sevenDayYield = (sevenDayYield / 100).toFixed(5) * 1;
        const thirtyDayYield = safeObjectRef(fund.oneMonthSecYield.r);
        if (thirtyDayYield) rowData.thirtyDayYield = (thirtyDayYield / 100).toFixed(5) * 1;
        rowData.source = 'BlackRock'
        rowData.ticker = ticker;
        rowData.timestamp = timestamp;
        resp.push(rowData);
    }
}
console.log(JSON.stringify(resp));