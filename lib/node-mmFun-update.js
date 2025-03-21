const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");
const { exit } = require('process');

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read in from stdin, the moneymarket.fun source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
const oldestDate = new Date('1/1/2020');
let resp = [];
// go through each ticker report provided.
for (let i = 0; i < json.length; i++) {
    const data = json[i];
    const ticker = data.ticker;
    const yields = data.yields;
    // work through each date in the ticker report.
    for (let p = 0; p < yields.length; p++) {
        const yieldDate = du.getDateFromYYYYMMDD(yields[p].date);
        if (yieldDate.getTime() < oldestDate.getTime()) {
            continue;
        }
        resp.push({
            "asOfDate": du.getISOString(yieldDate),
            "price": 1,
            "sevenDayYield": (safeObjectRef(yields[p].yield / 100)).toFixed(5) * 1,
            "source": 'moneymarket.fun',
            "ticker": ticker,
            "timestamp": timestamp,
        });
    }
}
console.log(JSON.stringify(resp));