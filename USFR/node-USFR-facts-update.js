// create a puppeteer instance.
import puppeteer from "puppeteer";

// initiate a browser instance with all the necessary tweaks for performance, etc.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    // we have to run interactive, or Wisdomtree.com blocks the request.
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--window-size=800,600', '--no-sandbox'] // small screen layout for simplicity & performance.
});

function run() {
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await browserPromise;
            const page = await browser.newPage();
            await page.setRequestInterception(true);
            // this will only process document requests, all graphics, etc. will be ignored for performance reasons.
            page.on('request', (request) => {
                if (request.resourceType() === 'document') {
                    request.continue();
                } else {
                    request.abort();
                }
            });
            await page.goto("https://www.wisdomtree.com/investments/etfs/fixed-income/usfr");
            // make sure the page has rendered at least to the ER section.
            const erElement = await page.waitForSelector('#fund-overview > div > div:nth-child(1) > table > tbody > tr.expense-ratio');
            // parse out the Expense Ratio.
            const er = await page.evaluate(() => {
                const item = document.querySelector('#fund-overview > div > div:nth-child(1) > table > tbody > tr.expense-ratio');
                const row = item.innerText.split('\t');
                if (row.length == 2) {
                    return row[1].replace(/%/, '') / 100;
                } else {
                    return 'unknown';
                }
            });

            // parse out As of Date (table entry is of the form 'As of 09/11/2024')
            // document.querySelector("#fund-overview > div > div:nth-child(1) > table > thead > tr > th:nth-child(2) > div > span")
            const asOfDate = await page.evaluate(() => {
                const item = document.querySelector('#fund-overview > div > div:nth-child(1) > table > thead > tr > th:nth-child(2) > div > span');
                if (item) {
                    const row = item.innerText;
                    const ds = row.replace(/As of /, '');
                    // need to fix dates from MM/DD/YYY to YYYY-MM-DD to allow sorting.
                    const dateString = ds.substring(6, 10) + '-' + ds.substring(0, 2) + '-' + ds.substring(3, 5);
                    return dateString;
                } else {
                    return '';
                }
            });

            // #details-left-panel-wrapper > h1
            const accountType = await page.evaluate(() => {
                const item = document.querySelector('#details-left-panel-wrapper > h1');
                if (item) {
                    const row = item.innerText.trim();
                    return row;
                } else {
                    return '';
                }
            });

            // parse out NAV (table entry is of the form '$50.139')
            // document.querySelector("#fund-nav > div > div:nth-child(1) > table > tbody > tr.strong > td:nth-child(2) > span")
            const nav = await page.evaluate(() => {
                const item = document.querySelector('#fund-nav > div > div:nth-child(1) > table > tbody > tr.strong > td:nth-child(2) > span');
                if (item) {
                    const row = item.innerText;
                    return row.replace(/\$/, '') * 1;
                } else {
                    return '';
                }
            });

            // #fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(3) > td:nth-child(2)
            // #fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(3) > td:nth-child(2)
            const aum = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(3) > td:nth-child(2)");
                if (item) {
                    const row = item.innerText;
                    return row.replace(/\$/, '').replace(/,/g, '') * 1000;
                } else {
                    return '';
                }
            });

            // parse out 30 Day SEC Yield (table entry is of the form '$50.139')
            const thirtyDayYield = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(11) > td:nth-child(2)");
                const row = item.innerText;
                if (row) {
                    return row.replace(/%/, '') / 100;
                }
                return '';
            });

            // #fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(9) > td:nth-child(2)
            const yieldToMaturity = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(9) > td:nth-child(2)");
                const row = item.innerText;
                if (row) {
                    return row.replace(/%/, '') / 100;
                }
                return '';
            });

            // #fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(10) > td:nth-child(2)
            const distributionYield = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(10) > td:nth-child(2)");
                const row = item.innerText;
                if (row) {
                    return row.replace(/%/, '') / 100;
                }
                return '';
            });

            // document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(5) > td:nth-child(2)")
            const weightedAverageCoupon = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(5) > td:nth-child(2)");
                const row = item.innerText;
                if (row) {
                    return row.replace(/%/, '') / 100;
                }
                return '';
            });

            // document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(7) > td:nth-child(2)")
            const durationYears = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(7) > td:nth-child(2)");
                if (item) {
                    const row = item.innerText;
                    return row * 1;
                } else {
                    return '';
                }
            });

            // #fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(6) > td:nth-child(2)
            const maturityYears = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(6) > td:nth-child(2)");
                if (item) {
                    const row = item.innerText;
                    return row * 1;
                } else {
                    return '';
                }
            });
            browser.close();

            // format return JSON message.
            let facts = [
                {
                    "ticker": "USFR",
                    "source": "Wisdomtree yields",
                    "timestamp": new Date()
                }
            ];
            if (accountType) facts[0].accountType = accountType;
            if (asOfDate) facts[0].asOfDate = asOfDate;
            if (nav) facts[0].nav = nav.toFixed(5) * 1;
            if (aum) facts[0].aum = aum;
            if (thirtyDayYield) facts[0].thirtyDayYield = thirtyDayYield.toFixed(4) * 1;
            if (yieldToMaturity) facts[0].yieldToMaturity = yieldToMaturity.toFixed(4) * 1;
            if (distributionYield) facts[0].distributionYield = distributionYield.toFixed(4) * 1;
            if (weightedAverageCoupon) facts[0].weightedAverageCoupon = weightedAverageCoupon.toFixed(4) * 1;
            if (durationYears > 0) facts[0].durationYears = durationYears.toFixed(2) * 1;
            if (maturityYears > 0) facts[0].maturityYears = maturityYears.toFixed(2) * 1;
            if (er) facts[0].expenseRatio = er.toFixed(5) * 1;
            return resolve(JSON.stringify(facts));
        } catch (e) {
            if (!(typeof browser === 'undefined')) browser.close();
            return reject(e);
        }
    })
}
// run the default function with a parameter of one page, results will be logged to console.
run().then(console.log).catch(console.error);