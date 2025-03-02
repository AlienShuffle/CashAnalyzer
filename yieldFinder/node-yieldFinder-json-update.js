// Work on POSIX and Windows
const fs = require("fs");
const du = require('../lib/dateUtils.js');

// read in from stdin, the yieldFinder.app source data.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
// parse the asOfDate found in argument 2 to the node call into YYY-MM-DD format.
const asOfDateYYYMMDD = du.getISOString(new Date());
// grab just the bank deposits report, I have the other data from other sources.
//const savingsAccounts = json.savingsAccounts;
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let acct in json) {
    if (acct.account_type == 'Savings Account') {
        const row = {
            "source": 'node-yieldFinder-json-update.js',
            "timestamp": asOfDateYYYMMDD,
            "accountType": acct.name,
            "apy": (acct.rate / 100).toFixed(4) * 1,
            "asOfDate": acct.rate_as_of,
        };
        resp.push(row);
    }
}
console.log(JSON.stringify(resp));