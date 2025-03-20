import { XMLParser } from 'fast-xml-parser';
import { XMLValidator } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a file of tickers, per line.
// The moneymarket.fun report has over 800 funds, I want to track a much smaller list.
const fundListBuffer = readFileSync(process.argv[2], 'utf8');
const fundList = fundListBuffer.split('\n');
let funds = [];
for (let i = 0; i < fundList.length; i++) if (fundList[i].length > 0) funds[fundList[i]] = true;

// read in the MFP XML file from stdin.
const xmlFile = readFileSync(0, 'utf8');
// validate the file to know it will parse.
const result = XMLValidator.validate(xmlFile);
if (result.err) throw "XML invalid: " + result.err.msg

// parse the XML into Javascript object tree (like normal JSON from a Javascript perspective)
const parser = new XMLParser();
const json = parser.parse(xmlFile);
const companies = json.root.company;

let resp = [];
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < companies.length; i++) {
    const co = companies[i];

    // skipped untracked tickers.
    if (!funds[co.class_ticker]) continue;

    resp.push({
        "ticker": co.class_ticker,
        "entity_name": co.entity_name,
        "series_name": co.series_name,
        "class_name": co.class_name,
        "cik": co.cik,
        "cikTen": String(co.cik).padStart(10, '0'),
        "series": co.series_id,
        "class": co.class_id
    });
}
console.log(JSON.stringify(resp));