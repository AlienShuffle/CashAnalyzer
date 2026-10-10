const du = require('../lib/dateUtils.js');
const { parseIoArgs, readJson, writeJson, runMain } = require('./jsonIO.js');
const io = parseIoArgs();

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

runMain(async () => {
    // read the moneymarket.fun source data json file.
    const json = await readJson(io.input);
    const timestamp = new Date();
    // get oldest date from ENV or default
    const oldestDate = new Date((typeof process.env.oldestDate === 'undefined') ? '1/1/2020' : process.env.oldestDate);
    let resp = [];
    // go through each ticker report provided.
    for (let i = 0; i < json.length; i++) {
        const data = json[i];
        const ticker = data.ticker;
        const yields = data.yields;
        // work through each date in the ticker report.
        for (let p = 0; p < yields.length; p++) {
            const yieldDate = du.getDateFromYYYYMMDD(yields[p].date);
            if (yieldDate.getTime() < oldestDate.getTime()) {
                continue;
            }
            resp.push({
                "asOfDate": du.getISOString(yieldDate),
                "nav": 1,
                "sevenDayYield": (safeObjectRef(yields[p].yield / 100)).toFixed(5) * 1,
                "source": 'moneymarket.fun',
                "ticker": ticker,
                "timestamp": timestamp,
            });
        }
    }
    await writeJson(resp, io.output);
});
