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
            await page.goto("https://www.wisdomtree.com/investments/global/etf-details/modals/distribuition-history?id={D6F20DDF-9393-431C-85D4-1DB46E5F2798}");
            await page.waitForSelector('tr');
            let distros = await page.evaluate(() => {
                let results = [];
                let items = document.querySelectorAll('tr');
                items.forEach((item) => {
                    // remove $ from amounts, split each entry by the tab separator.
                    const row = item.innerText.replace(/\$/g, '').split('\t');
                    if (row.length && row[0] != "Ex-Dividend Date") {
                        let rowData = {
                            exDividendDate: row[0],
                            recordDate: row[1],
                            payableDate: row[2],
                            ordinaryIncome: row[3] * 1,
                            stcg: row[4] * 1,
                            ltcg: row[5] * 1,
                            returnOfCapital: row[6] * 1,
                            totalDistribution: row[7] * 1
                        };
                        results.push(rowData);
                    }
                });
                return results;
            });
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