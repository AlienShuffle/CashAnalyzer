// Work on POSIX and Windows
const fs = require("fs");
// read in from stdin, the yieldFinder.app source data.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
// parse the asOfDate found in argument 2 to the node call into YYY-MM-DD format.
const asOfDateString = process.argv[2];
const asOfDate = new Date(asOfDateString);
const asOfDateYYYMMDD = asOfDate.getFullYear() + '-' +
    ((asOfDate.getMonth() + 1 + '')).padStart(2, '0') + '-' +
    (asOfDate.getDate() + '').padStart(2, '0');
// grab just the bank deposits report, I have the other data from other sources.
const savingsAccounts = json.savingsAccounts;
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let acct in savingsAccounts) {
    const row = {
        "source": 'node-yieldFinder-update.js',
        "timestamp": asOfDate,
        "accountType": savingsAccounts[acct].display_name,
        "apy": (savingsAccounts[acct].rate / 100).toFixed(4) * 1,
        "asOfDate": asOfDateYYYMMDD,
    };
    resp.push(row);
}
console.log(JSON.stringify(resp));