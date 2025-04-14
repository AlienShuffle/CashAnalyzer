// Work on POSIX and Windows
const fs = require("fs");
const process = require("process");
require('../lib/dynamicSort.js')();

const ticker = (process.argv[2]) ? process.argv[2] : null;

// read in from stdin, the yieldFinder.app source data json file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const distros = json.divCapGain.item;
// check if distro list is empty.
if ((typeof distros === "undefined")) process.exit(1);
const timestamp = new Date();
let resp = [];
for (let i = 0; i < distros.length; i++) {
    const distro = distros[i];
    const recordDate = distro.recordDate.substring(0, 10);

    // create a record of the distribution date first time we see it.
    if ((typeof resp[recordDate] === "undefined")) {
        resp[recordDate] = {
            timestamp: timestamp,
            exDividendDate: distro.recordDate.substring(0, 10),
            recordDate: distro.recordDate.substring(0, 10),
            payableDate: distro.payableDate.substring(0, 10),
            totalDistribution: 0,
            source: "Vanguard.com Distro",
        };
        if (ticker) resp[recordDate].ticker = ticker;
    }

    const amount = (distro.perShareAmount.substring(1) * 1).toFixed(6) * 1;
    switch (distro.type) {
        case 'Dividend':
            resp[recordDate].ordinaryIncome = amount;
            resp[recordDate].totalDistribution += amount;
            break;
        case 'ST Cap Gain':
            resp[recordDate].stcg = amount;
            resp[recordDate].totalDistribution += amount;
            break;
        case 'LT Cap Gain':
            resp[recordDate].ltcg = amount;
            resp[recordDate].totalDistribution += amount;
            break;
        case 'Return Of Capital': // I have never seen this @ Vanguard, likely wrong type name.
            resp[recordDate].returnOfCapital = amount;
            resp[recordDate].totalDistribution += amount;
            break;
        default:
            console.error('unknown distributions type = ' + distro.type);
            break;
    }
    resp[recordDate].totalDistribution = resp[recordDate].totalDistribution.toFixed(6) * 1;
}
let results = [];
for (i in resp) { results.push(resp[i]); }
console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));