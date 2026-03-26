import { readFileSync } from "fs";

// Function to convert a string like "20250430000000" to ISO date "YYYY-MM-DD"
const convertToISODate = (dateStr) => `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

// build a url for a given ticker and time range to fetch the yield history from cnbc.
function buildUrl(symbol, timeRange) {
    const base = "https://webql-redesign.cnbcfm.com/graphql";
    const params = {
        operationName: "getQuoteChartData",
        variables: JSON.stringify({ symbol, timeRange }),
        extensions: JSON.stringify({
            persistedQuery: {
                version: 1,
                sha256Hash: "9e1670c29a10707c417a1efd327d4b2b1d456b77f1426e7e84fb7d399416bb6b"
            }
        })
    };
    return base + "?" + Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
}

// read in from stdin, a list of tickers to query.
const stdinBuffer = readFileSync(0, 'utf-8');
const tickers = stdinBuffer.split("\n").filter(line => line.trim() != "");

let resp = [];
for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const url = buildUrl(ticker, "1Y");
    const response = await fetch(url);
    const json = await response.json();
    const priceBars = json.data.chartData.priceBars;
    const dateList = priceBars.map(bar => bar.tradeTime);
    const yields = priceBars.map(bar => bar.close);
    const timestamp = new Date;
    // drop last entry as it is actually a price, not a yield, and we only want the yield history.
    dateList.pop();
    yields.pop();

    // build the response for each ticker
    for (let i = 0; i < dateList.length; i++) {
        const asOfDate = convertToISODate(dateList[i]);
        const yieldVal = (yields[i] / 100).toFixed(6) * 1;
        resp.push({
            "asOfDate": asOfDate,
            "price": 1,
            "sevenDayYield": yieldVal,
            "source": 'cnbc',
            "ticker": ticker,
            "timestamp": timestamp,
        });
    }
}
console.log(JSON.stringify(resp));
