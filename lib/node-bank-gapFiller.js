const du = require('../lib/dateUtils.js');
const fs = require('fs');
require('../lib/dynamicSort.js')();

// read in from stdin, the yieldFinder-history data to be gapFilled.
const stdinBuffer = fs.readFileSync(process.stdin.fd);
const json = JSON.parse(stdinBuffer);
json.sort(dynamicSort('accountType', 'asOfDate'));

let currAccount = '';
let lastAPY;
let lastDate;
for (let i = 0; i < json.length; i++) {
    if (currAccount != json[i].accountType) {
        currAccount = json[i].accountType;
        lastAPY = json[i].apy;
        lastDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
        continue;
    }
    const lastDatePlusOne = du.getDatePlusOne(lastDate);
    const newDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
    if (newDate > lastDatePlusOne) {
        // insert a new filler entry based on last available date.
        lastDate = lastDatePlusOne;

        let gapDateISO = du.getISOString(lastDate);
        let newObj = {
            source: 'gapFiller',
            timestamp: new Date,
            accountType: currAccount,
            apy: lastAPY,
            asOfDate: gapDateISO,
        };
        // insert a gapfiller date into the middle of the year.
        json.splice(i, 0, newObj);
    } else {
        lastDate = newDate;
        lastAPY = json[i].apy;
    }
}
console.log(JSON.stringify(json));