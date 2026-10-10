const fs = require("fs");
const { readText, runMain } = require('../lib/jsonIO.js');
runMain(async () => {
const stdinBuffer = await readText();
const json = JSON.parse(stdinBuffer);
const cik = json.cik
const fiscalYearEnd = json.fiscalYearEnd;
if (cik && fiscalYearEnd) console.log(cik + ',' + fiscalYearEnd);
});
