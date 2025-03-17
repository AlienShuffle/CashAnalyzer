const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");
const { exit } = require('process');

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a file of tickers, per line.
// The moneymarket.fun report has over 800 funds, I want to track a much smaller list.
const fundListBuffer = fs.readFileSync(process.argv[2], 'utf8');
const fundList = fundListBuffer.split('\n');
let funds = [];
for (let i = 0; i < fundList.length; i++) if (fundList[i].length > 0) funds[fundList[i]] = true;

// read in from stdin, the moneymarket.fun source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish result if in the list.
for (let i = 0; i < json.length; i++) {
    const ticker = json[i].ticker;

    // skipped untracked tickers.
    if (!funds[ticker]) continue;

    resp.push({
        "asOfDate": json[i].lastDate,
        "price": 1,
        "sevenDayYield": (safeObjectRef(json[i].yield / 100)).toFixed(6) * 1,
        "source": 'moneymarket.fun',
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp));