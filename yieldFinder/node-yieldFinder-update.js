// Work on POSIX and Windows
const fs = require("fs");
//const du = require('../lib/dateUtils.js');

// read in from stdin, the yieldFinder.app source data json file.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
// grab just the bank deposits report, I have the other data from other sources.
//const savingsAccounts = json.savingsAccounts;
// convert the data into my facts file format and dump on stdout.
let resp = [];
//console.log('json.length = ' + json.length);
for (let i = 0; i < json.length; i++) {
    const acct = json[i];
    //console.log('acct.name = ' + acct.name);

    if (acct.account_type == 'Savings Account') {
        //console.log('acct.account_type == Savings Account');
        const row = {
            "source": 'node-yieldFinder-json-update.js',
            "timestamp": timestamp,
            "accountType": acct.name,
            "apy": (acct.rate / 100).toFixed(4) * 1,
            "asOfDate": acct.rate_as_of,
        };
        resp.push(row);
    }
}
console.log(JSON.stringify(resp));