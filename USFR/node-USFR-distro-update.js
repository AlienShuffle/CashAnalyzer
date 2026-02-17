// create a puppeteer instance.
import puppeteer from "puppeteer";

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
                const timestamp = String(new Date());
                items.forEach((item) => {
                    // finds the table, and parses it, assumed order for the resulting arrays from webpage.
                    // remove $ from amounts, split each entry by the tab separator.
                    const row = item.innerText.replace(/\$/g, '').split('\t');

                    if (row.length && row[0] != "Ex-Dividend Date") {
                        // need to fix dates from MM/DD/YYY to YYYY-MM-DD
                        function swapDate(ds) { return ds.substring(6, 10) + '-' + ds.substring(0, 2) + '-' + ds.substring(3, 5); }
                        let rowData = {
                            timestamp: timestamp,
                            exDividendDate: (row[0]) ? swapDate(row[0]) : '',
                            recordDate: (row[1]) ? swapDate(row[1]) : '',
                            payableDate: (row[2]) ? swapDate(row[2]) : '',
                        };
                        if ((row[3] * 1) > 0) rowData.ordinaryIncome = row[3] * 1;
                        if ((row[4] * 1) > 0) rowData.stcg = row[4] * 1;
                        if ((row[5] * 1) > 0) rowData.ltcg = row[5] * 1;
                        if ((row[6] * 1) > 0) rowData.returnOfCapital = row[6] * 1;
                        if ((row[7] * 1) > 0) rowData.totalDistribution = row[7] * 1;
                        results.push(rowData);
                    }
                });
                return results;
            });
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