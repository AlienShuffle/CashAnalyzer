import { readFileSync } from 'fs';
import process from 'process';
import dynamicSort from '../lib/dynamicSort.mjs';

// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a file of tickers, per line.
// The moneymarket.fun report has over 800 funds, I want to track a much smaller list.
const fundListBuffer = readFileSync(process.argv[2], 'utf8');
const fundList = fundListBuffer.split('\n');
let funds = [];
for (let i = 0; i < fundList.length; i++) if (fundList[i].length > 0) funds[fundList[i]] = true;

// read in from stdin, the moneymarket.fun source data json file.
const stdinBuffer = readFileSync(process.stdin.fd, 'utf-8');
const json = JSON.parse(stdinBuffer);
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < json.data.length; i++) {
    const item = json.data[i];
    const ticker = item[3];

    // skipped untracked tickers.
    if (!funds[ticker]) continue;

    resp.push({
        "ticker": ticker,
        "cik": item[0],
        "cikTen": String(item[0]).padStart(10, '0'),
        "series": item[1],
        "class": item[2]
    });
}
console.log(JSON.stringify(resp.sort(dynamicSort('ticker'))));