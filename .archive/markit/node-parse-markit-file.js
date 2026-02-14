const du = require('../lib/dateUtils.js');
const fs = require("fs");
const process = require("process");

// read in from stdin, the markit response and pull out the yield history and export the details.
const stdinBuffer = fs.readFileSync(0, 'utf-8');
const json = JSON.parse(stdinBuffer);
const dateList = json.Dates;
function findYields(components) {
    for (let i = 0; i < components.length; i++) {
        if (components[i].Type == 'Close')
            return components[i].Values;
    }
    return "";
}
const yields = findYields(json.Elements[0].ComponentSeries);
const ticker = json.Elements[0].DisplaySymbol;
const timestamp = new Date;
let resp = [];
// go through each ticker report provided, see if it is in the track list, publish map if in the list.
for (let i = 0; i < dateList.length; i++) {
    const asOfDate = dateList[i].substring(0, 10);
    const yield = (yields[i] / 100).toFixed(6) * 1;
    resp.push({
        "asOfDate": asOfDate,
        "price": 1,
        "sevenDayYield": yield,
        "source": 'deep',
        "ticker": ticker,
        "timestamp": timestamp,
    });
}
console.log(JSON.stringify(resp));
