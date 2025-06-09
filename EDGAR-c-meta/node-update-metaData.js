const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");
const { exit } = require('process');
require('../lib/dynamicSort.js')();

const debug = false;

// start some utilities here.
function titleCase(str) {
    let splitStr = str.toLowerCase().split(' ');
    for (let i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    return splitStr.join(' ');
}

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

/// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a JSON file of tickers with EDGAR keys.
// { "ticker","cik","series","class" }
const fundListBuffer = fs.readFileSync(process.argv[2], 'utf8');
const fundList = JSON.parse(fundListBuffer);
if (debug) console.log('fundList.length=' + fundList.length)

// take the fund CIK,fiscalyear table and injest as well.
const fiscalYearBuffer = fs.readFileSync(process.argv[3], 'utf8');
const fiscalYears = fiscalYearBuffer.split('\n');
function findFiscalYear(cik) {
    for (let i = 0; i < fiscalYears.length; i++) {
        if (fiscalYears[i].indexOf(cik) > -1) {
            const vals = fiscalYears[i].split(',');
            return vals[1];
        }
    }
}
if (debug) console.log('fiscalYears.length=' + fiscalYears.length)

// read in from stdin, the finra.org source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const finraFundList = JSON.parse(stdinBuffer);
function findfinraFundByTicker(ticker) {
    for (let i = 0; i < finraFundList.length; i++) {
        if (finraFundList[i].ticker == ticker) {
            return finraFundList[i];
        }
    }
    return '';
}

const timestamp = new Date();
let resp = [];
// go through each ticker report provided in the original fundlist, see if it is in the finraFund list, publish compbined result.
for (let i = 0; i < fundList.length; i++) {
    const coMap = fundList[i];
    const ticker = coMap.ticker;
    // pull data from finraFund Map file.
    const finraFund = findfinraFundByTicker(ticker);

    const cik = coMap.cik;
    // fiscalyear end from source data.
    const fiscalYear = findFiscalYear(cik);

    resp.push({
        "expenseRatio": safeObjectRef(finraFund.expenseRatio),
        "fiscalYearEnd": fiscalYear,
        "entity_name": coMap.entity_name,
        "series_name": coMap.series_name,
        "class_name": coMap.class_name,
        "cik": cik,
        "cikTen": coMap.cikTen,
        "series": coMap.series,
        "class": coMap.class,
        "mmName": safeObjectRef(finraFund.mmName),
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp.sort(dynamicSort('ticker'))));