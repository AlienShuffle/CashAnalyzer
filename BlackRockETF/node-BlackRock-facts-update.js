const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");
import dynamicSort from '../lib/dynamicSort.mjs';
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';
function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read HTML from file given as stdin, this is facts page on Blackrock.com.
const htmlString = readFileSync(0, 'utf8');
const root = parse(htmlString);
const childCnt = root.children.length;
console.error(`childNodes.length = ${childCnt}`);


// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a file of tickers, per line.
// The moneymarket.fun report has over 800 funds, I want to track a much smaller list.
const fundListBuffer = fs.readFileSync(process.argv[2], 'utf8');
const fundList = fundListBuffer.split('\n');
let funds = [];
for (let i = 0; i < fundList.length; i++) if (fundList[i].length > 0) funds[fundList[i]] = true;

const timestamp = new Date();
let resp = [];
// go through each ticker report provided, not structured as an array, instead a set of keys in a single object.
for (let key in json) {
    const fund = json[key];
    const ticker = fund.localExchangeTicker;
    if (!ticker) continue;
    if (!funds[ticker]) continue;

    let rowData = {};
    const dateInt = fund.navAmountAsOf.r;
    const year = Math.trunc(dateInt / 10000);
    const month = Math.trunc((dateInt % 10000) / 100);
    const day = Math.trunc(dateInt % 100);
    //console.error(`${ticker}: dateInt = ${dateInt} -> year = ${year}, month = ${month}, day = ${day}`);
    rowData.asOfDate = du.getISOString(new Date(year, month - 1, day));
    if (safeObjectRef(fund.navAmount) && safeObjectRef(fund.navAmount.r)) rowData.price = safeObjectRef(fund.navAmount.r);
    const sevenDayYield = (safeObjectRef(fund.oneWeekSecYield)) ? safeObjectRef(fund.oneWeekSecYield.r) : null;
    if (sevenDayYield) rowData.sevenDayYield = (sevenDayYield / 100).toFixed(5) * 1;
    const thirtyDayYield = (safeObjectRef(fund.thirtyDaySecYield)) ? safeObjectRef(fund.thirtyDaySecYield.r) : null;
    if (thirtyDayYield) rowData.thirtyDayYield = (thirtyDayYield / 100).toFixed(5) * 1;
    const twelveMonTrlYield = (safeObjectRef(fund.twelveMonTrlYield)) ? safeObjectRef(fund.twelveMonTrlYield.r) : null;
    if (twelveMonTrlYield) rowData.twelveMonTrlYield = (twelveMonTrlYield / 100).toFixed(5) * 1;
    rowData.source = 'BlackRock'
        if (safeObjectRef(fund.accountType)) rowData.accountType = safeObjectRef(fund.accountType);
    rowData.blackRockId = key * 1;
    rowData.baseUrl = `https://blackrock.com/us/individual/products/${key}/`;
    rowData.distroUrl = `${rowData.baseUrl}fund/1515394931018.ajax?fileType=xls&dataType=fund`;
    rowData.ticker = ticker;
    rowData.timestamp = timestamp;
    resp.push(rowData);
}

console.log(JSON.stringify(resp));