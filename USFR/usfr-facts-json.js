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
                }
            });
            /*
            const erValue = page.$(erSelector);
            //document.querySelector("#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(11) > td:nth-child(2)")
            const yieldSelector = '#fund-overview > div > div:nth-child(1) > table > tbody > tr:nth-child(11) > td:nth-child(2)';
            const yield = await page.waitForSelector(yieldSelector);
            */
            let distros = {
                asOfDate: '1/1/2023',
                nav: 1.90,
                secYield: 1 * 1,
                wam: 34,
                twelveMosTrailingYield: er,
                expenseRatio: er
            };
            browser.close();
            return resolve(JSON.stringify(distros));
        } catch (e) {
            browser.close();
            return reject(e);
        }
    })
}
// run the default function with a parameter of one page, results will be logged to console.
run().then(console.log).catch(console.error);