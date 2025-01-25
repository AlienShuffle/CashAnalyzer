const { table } = require('console');
const { exit } = require('process');
const puppeteer = require('puppeteer');

const fundTickerName = process.argv[2];
if (!fundTickerName || fundTickerName == '' || fundTickerName.length < 5) {
    console.error("Need a valid fundTickerName, not valid: '" + fundTickerName + "'");
    exit
}

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

            // so far nasdaq pages are structured the same, so we can re-use logic just different URLs.
            async function retrieveAPY(url) {
                try {
                    // Go for the Savings Rate
                    console.error('browsing to page', "1");
                    await page.goto(url);

                    // prase out as of date.
                    console.error('processing asOfPath', "2");
                    let asOfPath = "body > div.dialog-off-canvas-main-canvas > div > main > div.page__content > div.quote-detail-header__container > section > div.symbol-page-header__content-container > div > div > div.symbol-page-header__content > div.symbol-page-header__left > div.symbol-page-header__pricings > div.symbol-page-header__pricing.symbol-page-header__fix--margin.loaded > div.symbol-page-header__pricing-details.symbol-page-header__pricing-details--current.symbol-page-header__pricing-details--unchanged > span > div.symbol-page-header__timestamp > span";
                    let asOfHandle = await page.$(asOfPath);
                    console.error(asOfHandle);
                    const asOfDate = await page.evaluate(input => input.innerText, asOfHandle);

                    // parse out SEC 7 day Yield.
                    console.error('waiting tbody.summary-data__table-body', "3");
                    //let tableHandle = await page.$$('tbody.summary-data__table-body');
                    let tableHandle = await page.$$('tr.summary-data__row');
                    if (!tableHandle) console.error('selector not found');
                    //console.error(tableHandle);
                    //console.error('tableHandle.length=', tableHandle.length);
                    // get the html string for this table and log it.
                    for (let i = 0; i < tableHandle.length; i++) {
                        const tableValue = await page.evaluate(input => input.innerHTML, tableHandle[i]);
                        console.error('tableHandle index =', i);
                        console.error(tableValue);
                    }

                    console.error('processing yieldSelector', "4");
                    let rowsHandle = await tableHandle[0].$$('tr');
                    console.error('rowsHandle.length=', rowsHandle.length);
                    let yield = 'n/a';
                    for (let i = 0; i < rowsHandle.length; i++) {
                        let cols = await rowsHandle[i].$$('td');
                        if (cols.length < 2) continue;
                        const fieldName = await page.evaluate(input => input.innerHTML, cols[0]);
                        console.error('fieldName=', fieldName);
                        if (fieldName == '7 Day Yield') {
                            yield = await page.evaluate(input => input.innerHTML, cols[1]);
                            break;
                        }
                        if (fieldName == 'Gross Seven Day Yield') {
                            yield = await page.evaluate(input => input.innerHTML, cols[1]);
                            break;
                        }
                    }
                    console.error('yield=', yield);
                    return [yield, asOfDate];
                } catch (error) {
                    //if (browser) await browser.close();
                    console.error(((error.name === 'TimeoutError') ? 'Browser timeout occurred' : 'An error occured') + ': ' + url, error);
                    return reject(error);
                }
            }
            //
            const results = await retrieveAPY('https://www.nasdaq.com/market-activity/mutual-fund/' + fundTickerName.toLowerCase());

            // format return JSON message.
            const now = new Date;
            const asOfDate = new Date(results[1]);
            let facts = [
                {
                    "source": 'node-nasdaq-update.js',
                    "timestamp": now,
                    ticker: fundTickerName.toUpperCase(),
                    sevenDayYield: (results[0]) ? (results[0] / 100).toFixed(5) * 1 : 'n/a',
                    asOfDate: asOfDate,
                }
            ];

            //browser.close();
            return resolve(JSON.stringify(facts));
        } catch (error) {
            //if (browser) await browser.close();
            console.error('Some Error occured', error);
            return reject(error);
        }
    });
}
// run the default function with a parameter of one page, results will be logged to console.
run().then(console.log).catch(console.error);