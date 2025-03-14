// Work on POSIX and Windows
const fs = require("fs");

// read in from stdin, the yieldFinder.app source data json file.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let i = 0; i < json.length; i++) {
    const acct = json[i];
    if (acct.account_type == 'Savings Account') {
        const row = {
            "accountType": acct.name,
            "apy": (acct.rate / 100).toFixed(4) * 1,
            "asOfDate": acct.rate_as_of,
            "source": 'node-yieldFinder-json-update.js',
            "timestamp": timestamp,
        };
        resp.push(row);
    }
}
console.log(JSON.stringify(resp));