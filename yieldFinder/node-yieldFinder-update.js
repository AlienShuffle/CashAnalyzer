// Work on POSIX and Windows
const fs = require("fs");

// read in from stdin, the yieldFinder.app source data json file.
/** Sample
 * {
  "last_updated": "2025-10-11T21:12:04.827Z",
  "data": [
    {
      "date": "2025-10-11",
      "account_type": "Savings Account",
      "institution_name": "Ever Bank",
      "account_name": "Ever Bank",
      "value": 4.05
    }
  ]
}
 */
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const data = json.data;
const timestamp = new Date();
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let i = 0; i < data.length; i++) {
    const acct = data[i];
    if (acct.account_type == 'Savings Account') {
        const row = {
            "accountType": acct.account_name,
            "apy": (acct.value / 100).toFixed(4) * 1,
            "asOfDate": acct.date,
            "source": 'node-yieldFinder-json-update.js',
            "timestamp": timestamp,
        };
        resp.push(row);
    }
}
console.log(JSON.stringify(resp));