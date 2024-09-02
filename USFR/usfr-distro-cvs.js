// create a puppeteer instance.
const puppeteer = require('puppeteer');

// initiate a browser instance with all the necessary tweaks for performance, etc.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']  // big screen layout for debugging
    args: ['--window-size=800,600', '--no-sandbox'] // small screen layout for simplicity & performance.
});

function run(pagesToScrape) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!pagesToScrape) {
                pagesToScrape = 1;
            }
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
            let currentPage = 1;
            let urls = '';
            while (currentPage <= pagesToScrape) {
                await page.waitForSelector('tr');
                let newUrls = await page.evaluate(() => {
                    let results = '';
                    let items = document.querySelectorAll('tr');
                    items.forEach((item) => {
                        const row = item.innerText.replace(/\$/g, '').split('\t').toString();
                        if (row.length) results += row + "\n";
                    });
                    return results;
                });
                urls += newUrls;
                if (currentPage < pagesToScrape) {
                    await Promise.all([
                        await page.waitForSelector('tr'),
                        //await page.click('a.morelink'),
                        await page.waitForSelector('td')
                    ])
                }
                currentPage++;
            }
            browser.close();
            return resolve(urls);
        } catch (e) {
            return reject(e);
        }
    })
}
run(1).then(console.log).catch(console.error);