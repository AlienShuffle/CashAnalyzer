const { parseIoArgs, readJson, writeJson, runMain } = require('../lib/jsonIO.js');
require('../lib/dynamicSort.js')();

// usage: node node-convert-old-fido.js <ticker> [--input file] [--output file]  (defaults: stdin/stdout)
const io = parseIoArgs();
const tickerSymbol = io.args[0];
// get oldest date from ENV or default
//const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);

runMain(async () => {
    // read the MM fund history data to be converted.
    const preClean = await readJson(io.input);
    preClean.sort(dynamicSort('ticker', 'asOfDate'));
    // remove all the non-Fido elements elements.
    let json = [];
    for (let i = 0; i < preClean.length; i++) {
        if (preClean[i].source != 'fido14') continue;
        preClean[i].source = 'Fidelity.com';
        preClean[i].ticker = tickerSymbol;
        json.push(preClean[i]);
    }
    await writeJson(json, io.output);
});
