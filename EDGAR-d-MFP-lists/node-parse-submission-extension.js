const du = require('../lib/dateUtils.js');
const fs = require("fs");
const process = require("process");

// get oldest date from ENV or default
const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);

// If an argv[2] is provided, use as parsing rule for formType to extract.
const cik = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : '';
if (cik == '') throw 'missing arv[2]=cik!';
const formType = (process.argv[3] && process.argv[3].length > 1) ? process.argv[3] : 'MFP';

// read in from stdin, the list of submissions for this CIK and pull out the requested reports and export the details.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < json.accessionNumber.length; i++) {
    const reportDate = json.reportDate[i];
    const newDate = du.getDateFromYYYYMMDD(reportDate);
    // skip old reports.
    if (newDate.getTime() < oldestDate.getTime()) continue;
    // skip reports we aren't interested in.
    if (json.form[i].indexOf(formType) < 0) continue;

    const cleanCIK = cik.replace(/^0+/, '');
    const cleanAccessionNumber = json.accessionNumber[i].replace(/-/g, '')
    const url = `https://www.sec.gov/Archives/edgar/data/${cleanCIK}/${cleanAccessionNumber}/primary_doc.xml`;
    resp.push({
        "cik": cik,
        "accessionNumber": cleanAccessionNumber,
        "filingDate": json.filingDate[i],
        "reportDate": reportDate,
        "acceptanceDateTime": json.acceptanceDateTime[i],
        "form": json.form[i],
        "fileNumber": json.fileNumber[i],
        "core_type": json.core_type[i],
        "primaryDocument": json.primaryDocument[i],
        "url": url
    });
}
console.log(JSON.stringify(resp));
