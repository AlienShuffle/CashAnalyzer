const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read in from stdin, the yieldFinder.app source data json file.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
// convert the data into my facts file format and dump on stdout.
let resp = [];
for (let i = 0; i < json.length; i++) {
    const ticker = json[i].profile.ticker;
    switch (ticker) {
        case 'VCTXX':
        case 'VMFXX':
        case 'VMRXX':
        case 'VMSXX':
        case 'VUSXX':
        case 'VYFXX':
            const row = {
                "ticker": ticker,
                "source": 'Vanguard.com',
                "timestamp": timestamp,
                "accountType": safeObjectRef(json[i].profile.shortName),
                "sevenDayYield": (safeObjectRef(json[i].yield.yieldPct) / 100).toFixed(5) * 1,
                "asOfDate": du.getISOString(new Date(safeObjectRef(json[i].yield.asOfDate))),
            };
            resp.push(row);
            break;
        default:
            break;
    }
}
console.log(JSON.stringify(resp));