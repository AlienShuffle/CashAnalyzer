const du = require('../lib/dateUtils.js');
const { parseIoArgs, readJson, writeJson, runMain } = require('./jsonIO.js');
const io = parseIoArgs();

function safeObjectRef(obj) {
    if (typeof obj === "undefined") return "";
    return obj;
}

runMain(async () => {
    // read the yieldFinder.app source data json file.
    const json = await readJson(io.input);
    const timestamp = new Date();
    let resp = [];
    // go through each ticker report provided.
    for (let i = 0; i < json.length; i++) {
        const data = json[i];
        const accountType = data.historicalPricingYield[0].fiShortNm;
        const ticker = data.historicalPricingYield[0].tradingSymbolCd;
        // work through each date in the ticker report.
        for (let p = 0; p < data.historicalPricingYield[0].prices.length; p++) {
            const daily = data.historicalPricingYield[0].prices[p];
            resp.push({
                "accountType": accountType,
                "asOfDate": du.getISOString(new Date(safeObjectRef(daily.date))),
                "nav": 1,
                "oneDayYield": (safeObjectRef(daily.milRateAndYields[0].oneDayYield) / 100).toFixed(5) * 1,
                "sevenDayYield": (safeObjectRef(daily.milRateAndYields[0].sevenDayYield) / 100).toFixed(5) * 1,
                "thirtyDayYield": (safeObjectRef(daily.milRateAndYields[0].thirtyDayYield) / 100).toFixed(5) * 1,
                "source": 'Fidelity.com',
                "ticker": ticker,
                "timestamp": timestamp,
            });
        }
    }
    await writeJson(resp, io.output);
});
