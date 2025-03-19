const fs = require("fs");
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const cik = json.cik
const fiscalYearEnd = json.fiscalYearEnd;
if (cik && fiscalYearEnd) console.log(cik + ',' + fiscalYearEnd);