const du = require('../lib/dateUtils.js');
const fs = require("fs");

// read in from stdin, the list of submissions for this CIK and pull out post-2020 MFP reports and report.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const recentFilings = json.filings.recent;
const cik = json.cik;
const fiscalYearEnd = json.filings.fiscalYearEnd;
const oldestDate = new Date('1/1/2023');
let resp = [];
function insertUniqueResponse(obj) {
    for (let i = 0; i < resp.length; i++) {
        if (obj.fileNumber == resp[i].fileNumber &&
            obj.reportDate.getTime() == resp[i].reportDate.getTime()) {
            // reportDate matches, replace if newer, drop if older.
            if (obj.filingDate.getTime() > resp[i].filingDate.getTime()) {
                resp.splice(i, 1, obj);
            }
            return;
        }
    }
    resp.push(obj);
}

// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < recentFilings.accessionNumber.length; i++) {
    const reportDate = recentFilings.reportDate[i];
    const newDate = du.getDateFromYYYYMMDD(reportDate);
    // skip old reports.
    if (newDate.getTime() < oldestDate.getTime()) continue;
    // skip non monthly funds reports.
    if (recentFilings.form[i].indexOf('MFP') < 0) continue;

    const cleanCIK = cik.replace(/^0+/, '');
    const cleanAccessionNumber = recentFilings.accessionNumber[i].replace(/-/g, '')
    const url = `https://www.sec.gov/Archives/edgar/data/${cleanCIK}/${cleanAccessionNumber}/primary_doc.xml`;
    insertUniqueResponse({
        "cik": cik,
        "fiscalYearEnd": fiscalYearEnd,
        "accessionNumber": cleanAccessionNumber,
        "filingDate": du.getDateFromYYYYMMDD(recentFilings.filingDate[i]),
        "reportDate": newDate,
        "acceptanceDateTime": new Date(recentFilings.acceptanceDateTime[i]),
        "form": recentFilings.form[i],
        "fileNumber": recentFilings.fileNumber[i],
        "core_type": recentFilings.core_type[i],
        "primaryDocument": recentFilings.primaryDocument[i],
        "url": url
    });
}
console.log(JSON.stringify(resp));
