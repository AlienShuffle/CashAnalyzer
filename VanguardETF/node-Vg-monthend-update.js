const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require('fs');
//const process = require('process');

function safeObjectRef(obj) {
    if (typeof obj === 'undefined') return '';
    return obj;
}

// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a file of tickers, per line.
// The moneymarket.fun report has over 800 funds, I want to track a much smaller list.
const fundListBuffer = fs.readFileSync(process.argv[2], 'utf8');
const fundList = fundListBuffer.split('\n');
let funds = [];
for (let i = 0; i < fundList.length; i++) if (fundList[i].length > 0) funds[fundList[i]] = true;

// read in from stdin, the yieldFinder.app source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let i = 0; i < json.length; i++) {
    const ticker = json[i].profile.ticker;
    if (!funds[ticker]) continue;

    resp.push({
        "accountType": safeObjectRef(json[i].profile.shortName),
        "asOfDate": du.getISOString(new Date(safeObjectRef(json[i].yield.asOfDate))),
        "price": (safeObjectRef(json[i].dailyPrice.market.price) * 1).toFixed(4) * 1,
        "thirtyDayYield": (safeObjectRef(json[i].yield.yieldPct) / 100).toFixed(5) * 1,
        "source": 'Vanguard.com ETF',
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp));