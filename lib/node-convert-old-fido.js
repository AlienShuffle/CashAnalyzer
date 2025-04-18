const fs = require('fs');
require('../lib/dynamicSort.js')();

// if the script has an argument 'latest', then do not store history, only the most recent rate published.
const tickerSymbol = process.argv[2];
// get oldest date from ENV or default
//const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);

// read in from stdin, the MM fund history data to be sorted uniquely.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const preClean = JSON.parse(stdinBuffer);
preClean.sort(dynamicSort('ticker', 'asOfDate'));
// remove all the non-Fido elements elements.
let json = [];
for (let i = 0; i < preClean.length; i++) {
    if (preClean[i].source != 'fido14') continue;
    preClean[i].source = 'Fidelity.com';
    preClean[i].ticker = tickerSymbol;
    json.push(preClean[i]);
}
console.log(JSON.stringify(json));