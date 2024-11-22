const puppeteer = require('puppeteer');

// global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=800,600', '--no-sandbox']
    args: ['--window-size=800,600']
});

function run() {
    return new Promise(async (resolve, reject) => {
        const browser = await browserPromise;
        try {
            const page = await browser.newPage();

            // so far pages are structured the same, so we can re-use logic just different URLs, and path.
            async function retrieveAPY(url, path) {
                try {
                    await page.goto(url);
                    //this page is slow, let's wait.
                    await page.waitForNetworkIdle({
                        idleTime: 1000,
                    });
                    // make sure the page has rendered at least to the rates section.
                    await page.waitForSelector(path);
                } catch (error) {
                    if (browser) await browser.close();
                    console.error(((error.name === 'TimeoutError') ? 'Browser timeout occurred' : 'An error occured') + ': ' + url, error);
                    return reject(error);
                }
                // parse out savings Rate
                let inputHandle = await page.$(path);
                const apyString = await page.evaluate(input => input.innerText, inputHandle);
                //console.error("apyString = :" + apyString + ":");
                return apyString.replace(/%/, '');
            }
            // document.querySelector("#richtext-2ec99e4b5c > p:nth-child(1) > span > span")
            const cashPlusYield = await retrieveAPY('https://investor.vanguard.com/accounts-plans/vanguard-cash-plus-account', "#richtext-2ec99e4b5c > p:nth-child(1) > span > span");
            // document.querySelector("#richtext-fb6988b911 > p:nth-child(1) > span")
            const cashDepositYield = await retrieveAPY('https://investor.vanguard.com/investment-products/vanguard-cash-deposit', "#richtext-fb6988b911 > p:nth-child(1) > span");
            //console.error("cashDepositYield = :" + cashDepositYield + ":");
            // format return JSON message.
            const now = new Date;
            const asOfDate = now.getFullYear() + '-' + (now.getMonth() + 1 + '').padStart(2, '0') + '-' + (now.getDate() + '').padStart(2, '0');
            let facts = [
                {
                    "source": 'node-Vanguard-update.js',
                    "timestamp": now,
                    accountType: 'CashPlus',
                    apy: (cashPlusYield) ? cashPlusYield / 100 : 'n/a',
                    asOfDate: asOfDate,
                },
                {
                    "source": 'node-Vanguard-update.js',
                    "timestamp": now,
                    accountType: 'CashDeposit',
                    apy: (cashDepositYield) ? cashDepositYield / 100 : 'n/a',
                    asOfDate: asOfDate,
                },
            ];

            browser.close();
            return resolve(JSON.stringify(facts));
        } catch (error) {
            if (browser) await browser.close();
            console.error('Some Error occured', error);
            return reject(error);
        }
    });
}
// run the default function with a parameter of one page, results will be logged to console.
run().then(console.log).catch(console.error);