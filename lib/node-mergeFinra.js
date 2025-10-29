const du = require('./dateUtils.js');
const fs = require('fs');
require('./dynamicSort.js')();

// read in from stdin, the existing finra.json data to be sorted uniquely.
const existingBuffer = fs.readFileSync(0, 'utf-8');
const existingFinra = JSON.parse(existingBuffer);
existingFinra.sort(dynamicSort('ticker', 'timestamp'));

// read in the new finra data to see if it should updated/added to the official file.
const newBuffer = fs.readFileSync(process.argv[2], 'utf-8');
const newFinra = JSON.parse(newBuffer);
newFinra.sort(dynamicSort('ticker', 'timestamp'));

// loop through each new entry.
for (let n = 0; n < newFinra.length; n++) {
    const newDate = du.getDateFromYYYYMMDD(newFinra[n].timestamp);
    let newFound = false;
    // loop through existing list to find matches.
    for (let e = 0; e < existingFinra.length; e++) {
        if (newFinra[n].ticker != existingFinra[e].ticker)
            continue;
        // same ticker.
        if (newFinra[n].expenseRatio == existingFinra[e].expenseRatio) {
            newFound = true;
            break;
        }
        // different ER, need to find best one (newest)
        const existingDate = du.getDateFromYYYYMMDD(existingFinra[e].timestamp);
        if (newDate.getTime() <= existingDate.getTime()) {
            newFound = true;
            break;
        }
        // new entry is the better one.
        newFound = true;
        existingFinra[e] = newFinra[n];
    }
    // ticker was not found, add to the list.
    if (!newFound) {
        existingFinra.push(newFinra[n]);
    }
}
// sort list with additions, then export.
existingFinra.sort(dynamicSort('ticker', 'timestamp'));
console.log(JSON.stringify(existingFinra));