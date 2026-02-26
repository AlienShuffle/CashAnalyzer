import puppeteer from "puppeteer";
import { readFileSync } from 'fs';
import dynamicSort from '../lib/dynamicSort.mjs';
//import { duGetISOString } from "../lib/dateUtils.mjs";
function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

const debug = true;

if (process.argv.length != 3) throw 'missing argv[2] tickerlist.csv';
const tickerList = readFileSync(process.argv[2], 'utf-8').split("\n");

// read entire stdin (fd 0) as the JSON payload; using process.stdin directly
// would pass a Socket object which fs.readFileSync doesn't accept.
const contentText = readFileSync(0, 'utf-8');
const json = JSON.parse(contentText);
const datas = json.data.funds.etfs.datas;

let urls = [];
for (const fund of datas) {
    const ticker = fund.fundTicker;
    if (!tickerList.includes(ticker)) continue;
    console.error(`Parsing fund info: '${ticker}'`);
    let rowData = {
        ticker: ticker,
        url: `https://www.ssga.com/${fund.fundUri}`,
        timestamp: new Date()
    };
    if (safeObjectRef(fund.nav[1])) rowData.nav = fund.nav[1];
    if (safeObjectRef(fund.aum[1])) {
        const multiplier = fund.aum[0].toLowerCase().includes("b") ? 1e9 : fund.aum[0].toLowerCase().includes("m") ? 1e6 : 1;
        rowData.aum = fund.aum[1] * multiplier;
    }
    if (safeObjectRef(fund.asOfDate[1])) rowData.asOfDate = fund.asOfDate[1];
    if (safeObjectRef(fund.ter[1])) rowData.expenseRatio = fund.ter[1];
    urls.push(rowData);
}
//console.log(JSON.stringify(urls.sort(dynamicSort('ticker'))));

const browserPromise = puppeteer.launch({
    headless: false,    // true for production, false for debugging to see the browser.
    defaultViewport: null
});
const browser = await browserPromise;

// this is the main fund specific parsing function
let results = [];
for (const fund of urls) {

    // check fund information
    if (!safeObjectRef(fund.url)) {
        console.error(`Invalid fund info: '${fund}'`);
        continue;
    }
    const ticker = fund.ticker;
    const url = fund.url;

    console.error(`Scraping fund: ${ticker}`);

    const page = await browser.newPage();

    let rowData = {
        "ticker": ticker,
        "source": "ssga",
        "timestamp": new Date()
    };
    if (safeObjectRef(fund.nav)) rowData.nav = fund.nav;
    if (safeObjectRef(fund.aum)) rowData.aum = fund.aum;
    if (safeObjectRef(fund.asOfDate)) rowData.asOfDate = fund.asOfDate;
    if (safeObjectRef(fund.expenseRatio)) rowData.expenseRatio = fund.expenseRatio;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function selectElement(selector, click = false) {
        if (debug) console.error(`Selecting element '${selector}'`);
        const found = await page.evaluate((selector, click) => {
            const el = document.querySelector(selector);
            if (el) {
                el.scrollIntoView();
                el.focus();
                if (click) el.click();
                return el.innerText;
            } else {
                return null;
            }
        }, selector, click);
        if (debug) console.error(`Exiting selectElement() = ''''${found}''''`);
        return found;
    }

    //if (debug) console.error("Opening BlackRock iShares ETF page...");
    await page.goto(
        url,
        { waitUntil: "networkidle2" }
    );

    // now get thirty day yield and as of date
    const rawSecYield = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-thirtyDaySecYield > div.data');
    if (!rawSecYield) {
        console.error(`No thirtyDayYield found for ticker '${ticker}'`);
        break; // minimum requriement is to get the yield, if not found, skip the rest of processing for this ticker since it's likely the page structure has changed and other data points may also be missing or incorrect.
    }
    const secYield = (rawSecYield.replace("%", "").trim() / 100).toFixed(4) * 1;
    if (debug) console.error(`rawSecYield= '${rawSecYield}'=${secYield}`);
    const rawSecYieldAsOfDate = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-thirtyDaySecYield > div.caption > div');
    if (!rawSecYieldAsOfDate) {
        console.error(`No asOfDate found for ticker '${ticker}'`);
        break;
    } else {
        const secYieldAsOfDate = new Date(rawSecYieldAsOfDate.replace("as of ", "")).toISOString().split("T")[0];
        if (debug) console.error(`rawSecYieldAsOfDate='${rawSecYieldAsOfDate}'='${secYieldAsOfDate}'`);
        rowData.thirtyDayYield = secYield.toFixed(4) * 1;
        rowData.asOfDate = secYieldAsOfDate;
    }

    // Fund Name
    const rawFundName = await selectElement('#fundHeader > header.main-header > div.col-4.column.grid > div.column.main-header-holder.col-three-quarter-width > h1 > span');
    if (!rawFundName) {
        console.error(`No rawFundName found for ticker '${ticker}'`);
    } else {
        const fundName = rawFundName.trim();
        if (debug) console.error(`rawFundName= '${rawFundName}'=${fundName}`);
        if (fundName) rowData.fundName = fundName;
    }

    // Expense Ratio
    const rawExpenseRatio = await selectElement('#feeTable > div > div > table > tbody > tr.fee-code-expr > td.data');
    if (!rawExpenseRatio) {
        console.error(`No rawExpenseRatio found for ticker '${ticker}'`);
    } else {
        const expenseRatio = (rawExpenseRatio.replace("%", "").trim() / 100).toFixed(4) * 1;
        if (debug) console.error(`rawExpenseRatio= '${rawExpenseRatio}'=${expenseRatio}`);
        if (expenseRatio) rowData.expenseRatio = expenseRatio.toFixed(6) * 1;
    }

    // Assets Under Management (AUM)
    const rawAum = await selectElement('#keyFundFacts > div > div.float-left.in-left > div.product-data-item.col-totalNetAssetsFundLevel > div.data');
    if (!rawAum) {
        console.error(`No rawAum found for ticker '${ticker}'`);
    } else {
        const multiplier = rawAum.toLowerCase().includes("b") ? 1e9 : rawAum.toLowerCase().includes("m") ? 1e6 : 1;
        const aum = rawAum.replace(/[^0-9\.]/g, "").trim() * 1;
        if (debug) console.error(`rawAum= '${rawAum}'=${aum}`);
        if (aum) rowData.aum = (aum * multiplier).toFixed(0) * 1;
    }

    // Weighted Average Coupon
    const rawWeightedAverageCoupon = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-weightedAvgCouponFi > div.data');
    if (!rawWeightedAverageCoupon) {
        console.error(`No rawWeightedAverageCoupon found for ticker '${ticker}'`);
    } else {
        const weightedAverageCoupon = (rawWeightedAverageCoupon.replace("%", "").trim() / 100).toFixed(4) * 1;
        if (debug) console.error(`rawWeightedAverageCoupon= '${rawWeightedAverageCoupon}'=${weightedAverageCoupon}`);
        if (weightedAverageCoupon) rowData.weightedAverageCoupon = weightedAverageCoupon.toFixed(4) * 1;
    }

    // Duration Years
    const rawDurationYears = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-modelOad > div.data');
    if (!rawDurationYears) {
        console.error(`No rawDurationYears found for ticker '${ticker}'`);
    } else {
        const durationYears = rawDurationYears.replace("yrs", "").trim() * 1;
        if (debug) console.error(`rawDurationYears= '${rawDurationYears}'=${durationYears}`);
        if (durationYears) rowData.durationYears = durationYears.toFixed(1) * 1;
    }

    // Yield to Maturity (actually yield to worst)
    const rawYieldToWorst = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-yieldToWorst > div.data');
    if (!rawYieldToWorst) {
        console.error(`No rawYieldToWorst found for ticker '${ticker}'`);
    } else {
        const yieldToWorst = (rawYieldToWorst.replace("%", "").trim() / 100).toFixed(4) * 1;
        if (debug) console.error(`rawYieldToWorst= '${rawYieldToWorst}'=${yieldToWorst}`);
        if (yieldToWorst) rowData.yieldToWorst = yieldToWorst.toFixed(4) * 1;
    }

    // distribution yield not provided on BlackRock site, so skipping.

    // 12m trailing yield.
    const rawTrailing12mYield = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-twelveMonTrlYld > div.data');
    if (!rawTrailing12mYield) {
        console.error(`No rawTrailing12mYield found for ticker '${ticker}'`);
    } else {
        const trailing12mYield = (rawTrailing12mYield.replace("%", "").trim() / 100).toFixed(4) * 1;
        if (debug) console.error(`rawTrailing12mYield= '${rawTrailing12mYield}'=${trailing12mYield}`);
        if (trailing12mYield) rowData.twelveMonTrlYield = trailing12mYield.toFixed(4) * 1;
    }

    // Weighted Average Maturity
    const rawWeightedAverageMaturity = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-weightedAvgLife > div.data');
    if (!rawWeightedAverageMaturity) {
        console.error(`No rawWeightedAverageMaturity found for ticker '${ticker}'`);
    } else {
        const maturityYears = rawWeightedAverageMaturity.replace("yrs", "").trim() * 1;
        if (debug) console.error(`rawWeightedAverageMaturity= '${rawWeightedAverageMaturity}'=${maturityYears}`);
        if (maturityYears) rowData.maturityYears = maturityYears.toFixed(1) * 1;
    }

    // we have all the facts we need, push to results array.
    results.push(rowData);

    if (debug) console.error("Completed processing for ticker:", ticker);
    await sleep(2000);
    await page.close();
    // do only a few due to rate limiting concerns...
    if (results.length > 10) break;
}
if (debug) console.error("Script complete.");
// sort by ticker before printing
console.log(JSON.stringify(results.sort(dynamicSort('ticker'))));
browser.close();