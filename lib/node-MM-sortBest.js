const du = require('../lib/dateUtils.js');
const fs = require('fs');
require('../lib/dynamicSort.js')();

// if the script has an argument 'latest', then do not store history, only the most recent rate published.
const latestOnly = (process.argv[2] && process.argv[2].toLowerCase() == 'latest');
// get oldest date from ENV or default
const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);

// This is used to prioritize the unique sort of multiple data sources.
// This is why I am not using jq here. It may be possible to write a jq
// query, but this seems so much easier to maintain, probably faster too.
function sourcePriority(source) {
    const src = source.toLowerCase();
    // look for gapfiller first, as I am adding detail after for testing/verification.
    // gapfiller is replaced by any other source
    if (src.indexOf('gapfiller') > -1) return 1;

    // higher the value, the better.
    // assume fund provider is most reliable.
    if (src.indexOf('vanguard') > -1) return 10;
    if (src.indexOf('fido14') > -1) return 10;
    if (src.indexOf('fidelity') > -1) return 10;
    if (src.indexOf('schwab') > -1) return 10;
    if (src.indexOf('ally') > -1) return 10;
    if (src.indexOf('edgar') > -1) return 9;
    // this is our default baseline.
    if (src.indexOf('deep') > -1) return 6;         // markit.com as data source.
    if (src.indexOf('blackrock') > -1) return 6;    // keep this below EDGAR for now just in case it is not reliable.
    if (src.indexOf('moneymarket.fun') > -1) return 4;
    if (src.indexOf('mm.fun') > -1) return 4;
    // This should be good, but prioritize mm.fun.

    if (src.indexOf('nasdaq') > -1) return 2;       // asOf date is unreliable (I calculate it, it is not published)
    // the AI tool has some questions for me on reliability.
    if (src.indexOf('yieldfinder') > -1) return 3;
    if (src.indexOf('yieldmm') > -1) return 2;

    // unknown source is better than gapfiller, but overall untrusted.
    return 2;
}

function objectExists(obj) { return !(typeof obj === "undefined"); }

// read in from stdin, the MM fund history data to be sorted uniquely.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const preClean = JSON.parse(stdinBuffer);
preClean.sort(dynamicSort('ticker', 'asOfDate'));
// remove all the gapFiller elements.
let json = [];
for (let i = 0; i < preClean.length; i++) {
    if (sourcePriority(preClean[i].source) == 1) continue;
    json.push(preClean[i]);
}

let result = [];
let last = { 'ticker': '' };
let lastDate = oldestDate;
for (let i = 0; i < json.length; i++) {
    const newDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
    // drop old yields before our target begin date.
    if (newDate.getTime() < oldestDate.getTime()) {
        continue;
    }

    // skip gap filler entries.
    const thisPriority = sourcePriority(json[i].source);
    const thisDay = newDate.getDay();
    if (thisPriority == 1 ||
        (thisPriority < 5 && (thisDay == 0 || thisDay == 6))) {
        continue;
    }

    // skip if the entry has a zero (empty) yield.
    if (json[i].sevenDayYield == 0) {
        continue;
    }

    // ticker changed, need to store last for a new beginning and copy to output.
    if (last.ticker != json[i].ticker) {
        result.push(json[i]);
        last = json[i];
        lastDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
        continue;
    }

    // here we need to compare the new one with the last one. if they
    // are the same date, we tie break based upon the data source.
    if (newDate.getTime() == lastDate.getTime()) {
        // last entry for the same date was lower priority, so replace.
        const lastPriority = sourcePriority(last.source);
        const lastYieldCount = objectExists(last.oneDayYield) + objectExists(last.sevenDayYield) + objectExists(last.thirtyDayYield);
        const jsonYieldCount = objectExists(json[i].oneDayYield) + objectExists(json[i].sevenDayYield) + objectExists(json[i].thirtyDayYield);
        if (
            (thisPriority > lastPriority) ||   // use the higher priority result.
            (thisPriority == lastPriority &&   // if same priority, use one with more precision or one-day yields, or 30-days reported.
                (
                    // commented out the precision check as it was causing a flip flop between EDGAR and mm.fun.
                    // (objectExists(json[i].sevenDayYield) && objectExists(last.sevenDayYield) && (json[i].sevenDayYield.length > last.sevenDayYield.length)) ||
                    // (objectExists(json[i].thirtyDayYield) && objectExists(last.thirtyDayYield) && (json[i].thirtyDayYield.length > last.thirtyDayYield.length)) ||
                    // (objectExists(json[i].sevenDayYield) && objectExists(last.sevenDayYield)) ||
                    // (objectExists(json[i].thirtyDayYield) && objectExists(last.thirtyDayYield)) ||
                    (objectExists(json[i].oneDayYield) && !objectExists(last.oneDayYield)) ||
                    (objectExists(json[i].thirtyDayYield) && !objectExists(last.thirtyDayYield)) ||
                    jsonYieldCount > lastYieldCount
                )
            )
        ) {
            result.pop();
            result.push(json[i]);
            last = json[i];
            lastDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
        }
        // always continue, either replaced, or left alone.
        continue;
    }

    // This for creating a list of only the latest values.
    if (latestOnly) {
        if (newDate.getTime() > lastDate.getTime()) {
            result.pop();
            result.push(json[i]);
            last = json[i];
            lastDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
        }
        continue;
    }

    // now let's look to see if there is a gap, and fill it.
    if (lastDate.getTime() != oldestDate.getTime()) {
        for (let lastDatePlusOne = du.getDatePlusOne(lastDate);
            newDate.getTime() > lastDatePlusOne.getTime();
            lastDatePlusOne = du.getDatePlusOne(lastDatePlusOne)) {
            // insert a new filler entry based on last available date.
            // use last as the starting point (future changes independent).
            let newObj = {};
            Object.assign(newObj, last);
            // set gapFiller specific attribute updates.
            newObj.source = 'gapFiller (' + last.source + ')';
            newObj.timestamp = new Date;
            newObj.asOfDate = du.getISOString(lastDatePlusOne);
            result.push(newObj);
        }
    }

    // this happens in the default case, and when we did gapFilling.
    // add the current input date's data into the result.
    result.push(json[i]);
    last = json[i];
    lastDate = du.getDateFromYYYYMMDD(json[i].asOfDate);
}
console.log(JSON.stringify(result));