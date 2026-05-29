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
            await page.goto("https://www.wisdomtree.com/us/products/fixed-income/usfr");
            // wait for the distributions table to load
            await page.waitForSelector('table[aria-label="Recent Distributions Table"]');
            let distros = await page.evaluate(() => {
                let results = [];
                const table = document.querySelector('table[aria-label="Recent Distributions Table"]');
                const rows = table.querySelectorAll('tbody tr');
                const timestamp = String(new Date());
                
                rows.forEach((row) => {
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length >= 8) {
                        const exDivDate = cells[0].innerText.trim();
                        const recordDate = cells[1].innerText.trim();
                        const payableDate = cells[2].innerText.trim();
                        const ordinaryIncome = cells[3].innerText.trim();
                        const stcg = cells[4].innerText.trim();
                        const ltcg = cells[5].innerText.trim();
                        const returnOfCapital = cells[6].innerText.trim();
                        const totalDistribution = cells[7].innerText.trim();
                        
                        // Helper function to convert M/D/YYYY or MM/DD/YYYY to YYYY-MM-DD
                        function swapDate(ds) {
                            const parts = ds.split('/');
                            return parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
                        }
                        
                        let rowData = {
                            timestamp: timestamp,
                            exDividendDate: exDivDate ? swapDate(exDivDate) : '',
                            recordDate: recordDate ? swapDate(recordDate) : '',
                            payableDate: payableDate ? swapDate(payableDate) : '',
                        };
                        
                        const parseAmount = (str) => {
                            const num = parseFloat(str.replace(/\$|,/g, ''));
                            return num > 0 ? num : undefined;
                        };
                        
                        const oi = parseAmount(ordinaryIncome);
                        if (oi !== undefined) rowData.ordinaryIncome = oi;
                        
                        const stcgVal = parseAmount(stcg);
                        if (stcgVal !== undefined) rowData.stcg = stcgVal;
                        
                        const ltcgVal = parseAmount(ltcg);
                        if (ltcgVal !== undefined) rowData.ltcg = ltcgVal;
                        
                        const rocVal = parseAmount(returnOfCapital);
                        if (rocVal !== undefined) rowData.returnOfCapital = rocVal;
                        
                        const totalVal = parseAmount(totalDistribution);
                        if (totalVal !== undefined) rowData.totalDistribution = totalVal;
                        
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