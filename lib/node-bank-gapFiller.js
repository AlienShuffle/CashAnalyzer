const du = require('../lib/dateUtils.js');
const { parseIoArgs, readJson, writeJson, runMain } = require('../lib/jsonIO.js');

// usage: node node-bank-gapFiller.js [--input file] [--output file]  (defaults: stdin/stdout)
const io = parseIoArgs();
require('../lib/dynamicSort.js')();

runMain(async () => {
    // read the yieldFinder-history data to be gapFilled.
    const preClean = await readJson(io.input);
    preClean.sort(dynamicSort('accountType', 'asOfDate'));
    let json = [];
    // remove all the gapFiller elements, start anew.
    for (let i = 0; i < preClean.length; i++) {
        if (preClean[i].source == 'gapFiller') continue;
        json.push(preClean[i]);
    }

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
        if (newDate.getTime() > lastDatePlusOne.getTime()) {
            // insert a new filler entry based on last available date.
            lastDate = lastDatePlusOne;

            let gapDateISO = du.getISOString(lastDate);
            let newObj = {
                accountType: currAccount,
                apy: lastAPY,
                asOfDate: gapDateISO,
                source: 'gapFiller',
                timestamp: new Date,
            };
            // insert a gapfiller date into the middle of the year.
            json.splice(i, 0, newObj);
        } else {
            lastDate = newDate;
            lastAPY = json[i].apy;
        }
    }
    await writeJson(json, io.output);
});
