//const du = require('../lib/dateUtils.js');
const fs = require("fs");
const { exit } = require('process');
require('../lib/dynamicSort.js')();

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read in from stdin, the finra.org search source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const fundList = JSON.parse(stdinBuffer);
const timestamp = new Date();
let resp = [];
// go through each ticker report provided in the original fundlist, publish the key info.
for (let i = 0; i < fundList.length; i++) {
    const fund = fundList[i];
    const ticker = fund.ticker;
    if (!ticker) continue;
    resp.push({
        "expenseRatio": (safeObjectRef(fund.expenseRatio) / 100).toFixed(6) * 1,
        "mmName": safeObjectRef(fund.name),
        "ticker": ticker,
        "timestamp": timestamp
    });
}
console.log(JSON.stringify(resp.sort(dynamicSort('ticker'))));