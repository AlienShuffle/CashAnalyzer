const puppeteer = require('puppeteer');

// shared global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=800,600', '--no-sandbox']
    args: ['--window-size=800,600']
});
function run() {
    return new Promise(async (resolve, reject) => {
        try {
            const browser = await browserPromise;
            const page = await browser.newPage();

            // Go for the Savings Rate
            await page.goto('https://www.ally.com/bank/online-savings-account/');
            // this page is slow, let's wait.
            await page.waitForNetworkIdle({
                idleTime: 1000,
            });
            // make sure the page has rendered at least to the ER section.
            await page.waitForSelector('span.allysf-rates-v1-value');

            // parse out savings Rate
            // document.querySelector("#fund-nav > div > div:nth-child(1) > table > tbody > tr.strong > td:nth-child(2) > span")
            let savingsRate = await page.evaluate(() => {
                const item = document.querySelector("span.allysf-rates-v1-value");
                return (item) ? item.innerText : '';
            });

            await page.goto('https://www.ally.com/bank/no-penalty-cd/');
            // this page is slow, let's wait.
            await page.waitForNetworkIdle({
                idleTime: 1000,
            });
            // make sure the page has rendered at least to the ER section.
            await page.waitForSelector('span.allysf-rates-v1-value');

            // parse out savings Rate
            // document.querySelector("#fund-nav > div > div:nth-child(1) > table > tbody > tr.strong > td:nth-child(2) > span")
            let npcdRate = await page.evaluate(() => {
                const item = document.querySelector("span.allysf-rates-v1-value");
                return (item) ? item.innerText : '';
            });

            // format return JSON message.
            const now = new Date;
            const asOfDate = now.getFullYear() + '-' + (now.getMonth() + 1 + '').padStart(2, '0') + '-' + (now.getDate() + '').padStart(2, '0');
            let facts = [
                {
                    accountType: 'Savings',
                    apy: (savingsRate) ? savingsRate / 100 : 'n/a',
                    asOfDate: asOfDate,
                },
                {
                    accountType: 'NPCD',
                    apy: (npcdRate) ? npcdRate / 100 : 'n/a',
                    asOfDate: asOfDate,
                }
            ];

            browser.close();
            return resolve(JSON.stringify(facts));
        } catch (e) {
            if (!(typeof browser === 'undefined')) browser.close();
            return reject(e);
        }
    });
}
// run the default function with a parameter of one page, results will be logged to console.
run().then(console.log).catch(console.error);