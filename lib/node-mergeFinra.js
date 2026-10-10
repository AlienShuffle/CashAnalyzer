const du = require('./dateUtils.js');
const { parseIoArgs, readJson, writeJson, runMain } = require('./jsonIO.js');

// usage: node node-mergeFinra.js <newFinra.json> [--input existing.json] [--output merged.json]  (defaults: stdin/stdout)
const io = parseIoArgs();
require('./dynamicSort.js')();

runMain(async () => {
    // read the existing finra.json data to be sorted uniquely.
    const existingFinra = await readJson(io.input);
    existingFinra.sort(dynamicSort('ticker', 'timestamp'));

    // read in the new finra data to see if it should updated/added to the official file.
    const newFinra = await readJson(io.args[0]);
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
    await writeJson(existingFinra, io.output);
});
