// Work on POSIX and Windows
const fs = require("fs");
const process = require("process");
require('../lib/dynamicSort.js')();
const du = require('../lib/dateUtils.js');

//console.error(`argv.length=${process.argv.length}`);
//for (let i = 0; i<process.argv.length;i++) {
//    console.error(`argv[${i}]="${process.argv[i]}"`);
//}
const ticker = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : '';
if (ticker == '') throw 'missing arv[2]=ticker!';

// read in from stdin, the source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const distros = json.divCapGain.item;
// check if distro list is empty.
if ((typeof distros === "undefined")) process.exit(1);
const timestamp = new Date();
function parseIt(item) {
    return {
        "asOfDate": du.getISOString(new Date(item.yield.asOfDate)),
        "thirtyDayYield": (item.yield.yieldPct / 100).toFixed(4) * 1,
        "source": "Vanguard.com Distro",
        "ticker": ticker,
        "timestamp": timestamp,
    };
}
let resp = [];
if (Array.isArray(distros)) {
    resp.push(parseIt(distros[0]));
} else {
    resp.push(parseIt(distros));
}
console.log(JSON.stringify(resp));