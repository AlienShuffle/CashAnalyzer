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
function findFundByCik(cik, series, classId) {
    for (let i = 0; i < fundList.length; i++) {
        if (fundList[i].cik == cik && fundList[i].series == series, fundList[i].class == classId) {
            if (debug) console.log('found:' + cik + ':' + series + ':' + classId)
            return fundList[i];
        }
    }
    return '';
}
function findFundByTicker(ticker) {
    for (let i = 0; i < fundList.length; i++) {
        if (fundList[i].ticker == ticker) {
            if (debug) console.log('found:' + cik + ':' + series + ':' + classId)
            return fundList[i];
        }
    }
    return '';
}
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

// read in from stdin, the moneymarket.fun source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish result if in the list.
for (let i = 0; i < json.length; i++) {
    const ticker = json[i].ticker;
    // pull data from Company Map file.
    const coMap = findFundByTicker(ticker);

    // skipped untracked tickers.
    if (!coMap) continue;

    const cik = coMap.cik;
    // fiscalyear end from source data.
    const fiscalYear = findFiscalYear(cik);

    resp.push({
        "asOfDate": json[i].reportDate,
        "expenseRatio": (safeObjectRef(json[i].expenseRatio / 100)).toFixed(6) * 1,
        "fiscalYearEnd": fiscalYear,
        "entity_name": coMap.entity_name,
        "series_name": coMap.series_name,
        "class_name": coMap.class_name,
        "cik": cik,
        "cikTen": coMap.cikTen,
        "series": coMap.series,
        "class": coMap.class,
        "mmName": json[i].name,
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp.sort(dynamicSort('ticker'))));