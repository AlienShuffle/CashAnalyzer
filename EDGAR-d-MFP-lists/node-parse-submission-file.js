const du = require('../lib/dateUtils.js');
const fs = require("fs");
const process = require("process");

// If an argv[2] is provided, use as parsing rule for formType to extract.
const formType = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : 'MFP';

// read in from stdin, the list of submissions for this CIK and pull out the requested reports and export the details.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const recentFilings = json.filings.recent;
const cik = json.cik;
const fiscalYearEnd = json.filings.fiscalYearEnd;
// get oldest date from ENV or default
const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < recentFilings.accessionNumber.length; i++) {
    const reportDate = recentFilings.reportDate[i];
    const newDate = du.getDateFromYYYYMMDD(reportDate);
    // skip old reports.
    if (newDate.getTime() < oldestDate.getTime()) continue;
    // skip reports we aren't interested in.
    if (recentFilings.form[i].indexOf(formType) < 0) continue;

    const cleanCIK = cik.replace(/^0+/, '');
    const cleanAccessionNumber = recentFilings.accessionNumber[i].replace(/-/g, '')
    const url = `https://www.sec.gov/Archives/edgar/data/${cleanCIK}/${cleanAccessionNumber}/primary_doc.xml`;
    resp.push({
        "cik": cik,
        "fiscalYearEnd": fiscalYearEnd,
        "accessionNumber": cleanAccessionNumber,
        "filingDate": recentFilings.filingDate[i],
        "reportDate": reportDate,
        "acceptanceDateTime": recentFilings.acceptanceDateTime[i],
        "form": recentFilings.form[i],
        "fileNumber": recentFilings.fileNumber[i],
        "core_type": recentFilings.core_type[i],
        "primaryDocument": recentFilings.primaryDocument[i],
        "url": url
    });
}
console.log(JSON.stringify(resp));
