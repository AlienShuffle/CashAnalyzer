const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require('fs');
const process = require('process');

function safeObjectRef(obj) {
    if (typeof obj === 'undefined') return '';
    return obj;
}

// read in from stdin, the yieldFinder.app source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
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
                "accountType": safeObjectRef(json[i].profile.shortName),
                "asOfDate": du.getISOString(new Date(safeObjectRef(json[i].yield.asOfDate))),
                "price": 1,
                "sevenDayYield": (safeObjectRef(json[i].yield.yieldPct) / 100).toFixed(5) * 1,
                "source": 'Vanguard.com',
                "ticker": ticker,
                "timestamp": timestamp,
            };
            resp.push(row);
            break;
        default:
            break;
    }
}
console.log(JSON.stringify(resp));