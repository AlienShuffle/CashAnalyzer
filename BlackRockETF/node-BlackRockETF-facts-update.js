import puppeteer from "puppeteer";
import { readFileSync } from "fs";

//function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

const debug = false;

const browserPromise = puppeteer.launch({
    //headless: false,    // true for production, false for debugging to see the browser.
    defaultViewport: null
});
const browser = await browserPromise;

// this is the main function
// get a list of tickers with site URL (ticker,url) from stdin, scrape each one, and output facts as JSON to stdout
const rawFunds = readFileSync(0, 'utf8');
const funds = rawFunds.split('\n').filter(line => line.trim().length > 0);
if (debug) console.error(`Scraping: '${funds.join(", ")}'`);

let results = [];
for (const fund of funds) {

    // set fund information
    const fundInfo = fund.split(",");
    if (fundInfo.length < 2) {
        console.error(`Invalid fund info: '${fund}'`);
        continue;
    }
    const ticker = fundInfo[0];
    const url = fundInfo[1];

    console.error(`Scraping fund: ${ticker}`);
    const page = await browser.newPage();

    let rowData = {
        "ticker": ticker,
        "source": "BlackRock",
        "timestamp": new Date()
    };

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
        if (durationYears) rowData.durationYears = durationYears.toFixed(2) * 1;
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

    // Weighted Average Maturity (maturityYears)
    const rawMaturityYears = await selectElement('#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-weightedAvgLife > div.data');
    if (!rawMaturityYears) {
        console.error(`No rawWeightedAverageMaturity found for ticker '${ticker}'`);
    } else {
        const maturityYears = rawMaturityYears.replace("yrs", "").trim() * 1;
        if (debug) console.error(`rawWeightedAverageMaturity= '${rawMaturityYears}'=${maturityYears}`);
        if (maturityYears) rowData.maturityYears = maturityYears.toFixed(2) * 1;
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
console.log(JSON.stringify(results));
browser.close();