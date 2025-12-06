const { isArrayBufferView } = require('util/types');
const du = require('../lib/dateUtils.js');
// Work on POSIX and Windows
const fs = require("fs");
require('../lib/dynamicSort.js')();

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

// read in from stdin, the Vanguard price history tool source data rows file.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const timestamp = new Date();
let resp = [];
// go through each ticker report provided.
for (let i = 0; i < json.length; i++) {
    const ticker = json[i].ticker;
    if (!ticker) continue;
    if (!safeObjectRef(json[i].yields)) continue;
    if (!safeObjectRef(json[i].yields.content[0])) continue;
    if (!safeObjectRef(json[i].yields.content[0].yields)) continue;

    const yields = json[i].yields.content[0].yields;
    const numRows = yields.length;

    let buffer = {};
    for (let j = 0; j < numRows; j++) {
        const yield = yields[j];
        if (yield.timePeriodCode != 'D') continue;
        const effectiveDate = yield.effectiveDate;
        if (!buffer[effectiveDate]) {
            buffer[effectiveDate] = {
                "oneDayYield": null,
                "sevenDayYield": null,
                "thirtyDayYield": null,
            };
        }
        switch (yield.yieldCode) {
            case '1DISTYLD':
                buffer[effectiveDate].oneDayYield = (parseFloat(yield.percent) / 100).toFixed(6) * 1;
                break;
            case 'SEC':
                if (safeObjectRef(yield.methCode) && yield.methCode === 'SEC-30-D')
                    buffer[effectiveDate].thirtyDayYield = (parseFloat(yield.percent) / 100).toFixed(6) * 1;
                else
                    buffer[effectiveDate].sevenDayYield = (parseFloat(yield.percent) / 100).toFixed(6) * 1;
                break;
            case '30DISTYLD':
                buffer[effectiveDate].thirtyDayYield = (parseFloat(yield.percent) / 100).toFixed(6) * 1;
                break;
            default:
                break;
        }
    }
    for (const effectiveDate of Object.keys(buffer)) {
        if (!safeObjectRef(buffer[effectiveDate])) continue;
        if (!safeObjectRef(buffer[effectiveDate].sevenDayYield)) continue;
        let tickerData = {};
        tickerData.asOfDate = effectiveDate;
        tickerData.price = 1;
        if (safeObjectRef(buffer[effectiveDate].oneDayYield)) tickerData.oneDayYield = buffer[effectiveDate].oneDayYield;
        if (safeObjectRef(buffer[effectiveDate].sevenDayYield)) tickerData.sevenDayYield = buffer[effectiveDate].sevenDayYield;
        if (safeObjectRef(buffer[effectiveDate].thirtyDayYield)) tickerData.thirtyDayYield = buffer[effectiveDate].thirtyDayYield;
        tickerData.source = 'Vanguard.com Inst Price History';
        tickerData.ticker = ticker;
        tickerData.timestamp = timestamp;
        resp.push(tickerData);
    }
}
console.log(JSON.stringify(resp.sort(dynamicSort('ticker', 'asOfDate'))));