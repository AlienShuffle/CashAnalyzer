// create a puppeteer instance.
const puppeteer = require('puppeteer');

// initiate a browser instance with all the necessary tweaks for performance, etc.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    // we have to run interactive, or Wisdomtree.com blocks the request.
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']  // big screen layout for debugging
    args: ['--window-size=800,600', '--no-sandbox'] // small screen layout for simplicity & performance.
});

function run() {
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await browserPromise;
            const page = await browser.newPage();
            await page.setRequestInterception(true);
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
            let er = await page.evaluate(() => {
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
            let asOfDate = await page.evaluate(() => {
                const item = document.querySelector('#fund-overview > div > div:nth-child(1) > table > thead > tr > th:nth-child(2) > div > span');
                const row = item.innerText;
                return row.replace(/As of /, '');
            });

            // parse out NAV (table entry is of the form '$50.139')
            // document.querySelector("#fund-nav > div > div:nth-child(1) > table > tbody > tr.strong > td:nth-child(2) > span")
            let navValue = await page.evaluate(() => {
                const item = document.querySelector('#fund-nav > div > div:nth-child(1) > table > tbody > tr.strong > td:nth-child(2) > span');
                const row = item.innerText;
                return row.replace(/\$/, '') * 1;
            });

            // parse out 30 Day SEC Yield (table entry is of the form '$50.139')
            // document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(11)")
            let secYield = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(11)");
                const row = item.innerText.split('\t');
                if (row.length == 2) {
                    return row[1].replace(/%/, '') / 100;
                }
                return '';
            });

            // parse out Effective Duration instead of WAM (table entry is of the form '0.02' years, we multiply by 365)
            // document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(7) > td:nth-child(2)")
            let effectiveDuration = await page.evaluate(() => {
                const item = document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(7) > td:nth-child(2)");
                const row = item.innerText;
                return row.replace(/%/, '') * 365;
            });
            // format return JSON message.
            let distros = {
                timestamp: String(new Date()),
                asOfDate: asOfDate,
                nav: navValue.toFixed(5) * 1,
                secYield: secYield.toFixed(5) * 1,
                effectiveDuration: effectiveDuration.toFixed(1) * 1,
                expenseRatio: er.toFixed(5) * 1
            };
            browser.close();
            return resolve(JSON.stringify(distros));
        } catch (e) {
            if (!(typeof browser === 'undefined')) browser.close();
            return reject(e);
        }
    })
}
// run the default function with a parameter of one page, results will be logged to console.
run().then(console.log).catch(console.error);