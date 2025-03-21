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

            // so far Ally pages are structured the same, so we can re-use logic just different URLs.
            async function retrieveAPY(url) {
                try {
                    // Go for the Savings Rate
                    await page.goto(url);
                    // make sure the page has rendered at least to the rates section, then parse.
                    let selector = await page.waitForSelector('span.allysf-rates-v1-value');
                    if (!selector) console.error('selector not found');

                    // parse out savings Rate (see Vanguard for more generic version that allows selectors as paramaters.)
                    const apy = await page.evaluate(() => {
                        const item = document.querySelector('span.allysf-rates-v1-value');
                        return (item) ? item.innerText : '';
                    });
                    //console.error('APY=', apy);
                    return apy;
                } catch (error) {
                    if (browser) await browser.close();
                    console.error(((error.name === 'TimeoutError') ? 'Browser timeout occurred' : 'An error occured') + ': ' + url, error);
                    return reject(error);
                }
            }
            //
            const npcdRate = await retrieveAPY('https://www.ally.com/bank/no-penalty-cd/');
            const savingsRate = await retrieveAPY('https://www.ally.com/bank/online-savings-account/');

            // format return JSON message.
            const now = new Date;
            const asOfDate = now.getFullYear() + '-' + (now.getMonth() + 1 + '').padStart(2, '0') + '-' + (now.getDate() + '').padStart(2, '0');
            let facts = [];
            if (savingsRate)
                facts.push({
                    accountType: 'Savings',
                    apy: (savingsRate) ? (savingsRate / 100).toFixed(4) * 1 : 'n/a',
                    asOfDate: asOfDate,
                    "source": 'node-Ally-update.js',
                    "timestamp": now,
                });
            if (npcdRate) facts.push({

                accountType: 'NPCD',
                apy: (npcdRate) ? (npcdRate / 100).toFixed(4) * 1 : 'n/a',
                asOfDate: asOfDate,
                "source": 'node-Ally-update.js',
                "timestamp": now,
            });
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