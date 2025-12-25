const du = require('./dateUtils.js');
const fs = require('fs');
require('./dynamicSort.js')();

// if the script has an argument 'latest', then do not store history, only the most recent rate published.
let latestOnly = false;
let sortDate = 'asOfDate';
let sortReverse = false;
for (let i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
        case 'latest':
        case '--latest':
            latestOnly = true;
            break;
        case '--sortDate':
            sortDate = process.argv[i + 1];
            i++;
            break;
        case '--sortReverse':
            sortReverse = true;
            break;
        default:
            console.error(`Unknown argument: ${process.argv[i]}`);
            break;
    }
}
// get oldest date from ENV or default
const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);

function objectExists(obj) { return !(typeof obj === "undefined"); }

// read in from stdin, the MM fund history data to be sorted uniquely.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
json.sort(dynamicSort('ticker', (sortReverse) ? `-${sortDate}` : sortDate));

let result = [];
let last = { 'ticker': '' };
let lastDate = oldestDate;
for (let i = 0; i < json.length; i++) {
    const newDate = du.getDateFromYYYYMMDD(json[i][sortDate]);
    // drop old items before our target begin date.
    if (newDate.getTime() < oldestDate.getTime()) {
        continue;
    }

    // ticker changed, need to store last for a new beginning and copy to output.
    if (last.ticker != json[i].ticker) {
        result.push(json[i]);
        last = json[i];
        lastDate = du.getDateFromYYYYMMDD(json[i][sortDate]);
        continue;
    }

    // here we need to compare the new one with the last one. if they
    // are the same date, we tie break based upon the data source.
    if (newDate.getTime() == lastDate.getTime()) {
        // last entry for the same date was lower priority, so replace.
        const lastSize = Object.keys(last).length;
        const jsonSize = Object.keys(json[i]).length;
        const lastTime = objectExists(last.timestamp) ? new Date(last.timestamp).getTime() : 0;
        const jsonTime = objectExists(json[i].timestamp) ? new Date(json[i].timestamp).getTime() : 0;
        if (
            (jsonSize > lastSize) ||   // use the larger data set.
            (jsonSize == lastSize && jsonTime > lastTime) // use the newer timestamp.
        ) {
            result.pop();
            result.push(json[i]);
            last = json[i];
            lastDate = du.getDateFromYYYYMMDD(json[i][sortDate]);
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
            lastDate = du.getDateFromYYYYMMDD(json[i][sortDate]);
        }
        continue;
    }

    // add the current input date's data into the result.
    result.push(json[i]);
    last = json[i];
    lastDate = du.getDateFromYYYYMMDD(json[i][sortDate]);
}
console.log(JSON.stringify(result));