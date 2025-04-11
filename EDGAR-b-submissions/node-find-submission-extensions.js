const du = require('../lib/dateUtils.js');
const fs = require("fs");
const process = require("process");

// If an argv[2] is provided, use as parsing rule for formType to extract.
const formType = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : 'MFP';

// read in from stdin, the list of submissions for this CIK and pull out the requested reports and export the details.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const recentFilings = json.filings.files;
const cik = json.cik;
const fiscalYearEnd = json.filings.fiscalYearEnd;
const oldestDate = new Date('1/1/2019');
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < recentFilings.length; i++) {
    const filingToISO = recentFilings[i].filingTo;
    const filingToDate = du.getDateFromYYYYMMDD(filingToISO);
    // skip old reports.
    if (filingToDate.getTime() < oldestDate.getTime()) continue;
    const filingFromISO = recentFilings[i].filingFrom;
    const fileName = recentFilings[i].name;
    const url = `https://data.sec.gov/submissions/${fileName}`;
    resp.push({
        "cik": cik,
        "fiscalYearEnd": fiscalYearEnd,
        "filingTo": filingToISO,
        "filingFrom": filingFromISO,
        "fileName": fileName,
        "url": url,
    });
}
console.log(JSON.stringify(resp));
