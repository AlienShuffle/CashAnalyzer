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
            await page.goto("https://www.wisdomtree.com/us/products/fixed-income/usfr");
            // wait for the page to render the Fund Overview grid
            await page.waitForSelector('[role="grid"]');
            
            // Helper function to extract text from grid rows
            const getGridValue = async (labelText) => {
                return await page.evaluate((label) => {
                    // Find the rowheader that contains the label text
                    const rowheaders = Array.from(document.querySelectorAll('[role="rowheader"]'));
                    const labelElement = rowheaders.find(el => el.innerText.includes(label));
                    if (labelElement) {
                        // The next rowheader in the same row contains the value
                        const row = labelElement.closest('[role="row"]');
                        if (row) {
                            const rowheaders = row.querySelectorAll('[role="rowheader"]');
                            return rowheaders[rowheaders.length - 1].innerText;
                        }
                    }
                    return '';
                }, labelText);
            };

            // parse out the Expense Ratio.
            const erText = await getGridValue('Expense Ratio');
            const er = erText ? parseFloat(erText.replace(/%/, '')) / 100 : 'unknown';

            // parse out As of Date (find from any table header that says "As of")
            const asOfDate = await page.evaluate(() => {
                const headers = Array.from(document.querySelectorAll('[role="columnheader"]'));
                const dateHeader = headers.find(h => h.innerText.includes('As of'));
                if (dateHeader) {
                    const ds = dateHeader.innerText.replace(/As of /, '');
                    // need to fix dates from M/D/YYYY or MM/DD/YYYY to YYYY-MM-DD to allow sorting.
                    const parts = ds.split('/');
                    const dateString = parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
                    return dateString;
                }
                return '';
            });

            // Get the account type from the main heading
            const accountType = await page.evaluate(() => {
                const heading = document.querySelector('h1');
                if (heading) {
                    const text = heading.innerText.trim();
                    // Extract just the fund name after the ticker
                    return text.replace(/^[A-Z]+\s/, '');
                }
                return '';
            });

            // parse out NAV from the "Net Asset Value" grid
            const navText = await getGridValue('NAV');
            const nav = navText ? parseFloat(navText.replace(/\$/, '').replace(/,/g, '')) : '';

            // parse out Total Assets (in thousands, so multiply by 1000)
            const aumText = await getGridValue('Total Assets');
            const aum = aumText ? parseFloat(aumText.replace(/\$/, '').replace(/,/g, '')) * 1000 : '';

            // parse out 30 Day SEC Yield
            const thirtyDayYieldText = await getGridValue('SEC 30-day Yield');
            const thirtyDayYield = thirtyDayYieldText ? parseFloat(thirtyDayYieldText.replace(/%/, '')) / 100 : '';

            // parse out Average Yield to Maturity (was "Yield to Maturity")
            const yieldToMaturityText = await getGridValue('Average Yield to Maturity');
            const yieldToMaturity = yieldToMaturityText ? parseFloat(yieldToMaturityText.replace(/%/, '')) / 100 : '';

            // parse out Distribution Yield
            const distributionYieldText = await getGridValue('Distribution Yield');
            const distributionYield = distributionYieldText ? parseFloat(distributionYieldText.replace(/%/, '')) / 100 : '';

            // parse out Weighted Average Coupon
            const weightedAverageCouponText = await getGridValue('Weighted Average Coupon');
            const weightedAverageCoupon = weightedAverageCouponText ? parseFloat(weightedAverageCouponText.replace(/%/, '')) / 100 : '';

            // parse out Effective Duration (was "duration years")
            const durationYearsText = await getGridValue('Effective Duration');
            const durationYears = durationYearsText ? parseFloat(durationYearsText) : '';

            // parse out Average Years to Maturity (was "maturity years")
            const maturityYearsText = await getGridValue('Average Years to Maturity');
            const maturityYears = maturityYearsText ? parseFloat(maturityYearsText) : '';
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