const du = require('../lib/dateUtils.js');
const puppeteer = require("puppeteer");

// shared global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    //headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']
    args: ['--window-size=800,600', '--no-sandbox']
});

function run() {
    return new Promise(async (resolve, reject) => {
        const browser = await browserPromise;
        const page = await browser.newPage();

        const url =
            'https://www.papowerswitch.com/shop-for-rates-results?' +
            'zip=17922' +
            '&distributor=1186' +
            '&distributorrate=RS%20-%20Regular%20Residential%20Service' +
            '&servicetype=residential' +
            '&usage=1300' +         // typical house.
            //'&term-length=12' +   // comment out if you want all term lengths.
            '&min-price=.05' +
            '&max-price=.12' +      // this may need to be increased depending on rates.
            '&ratePreferences%5B%5D=fixed&offerPreferences%5B%5D=no_cancellation' +
            '&offerPreferences%5B%5D=no_enrollment' +
            '&offerPreferences%5B%5D=no_monthly' +
            '&sortby=est_a';

        // browse to the marketable securities page
        await page.goto(url);
        inputHandle = await page.$("#shop-for-rates");

        //await page.$("#filter-form > div.offers-wrap > div.ptc.show-980-more > div.card.dist-card > div > div.container.first > div:nth-child(2) > span.highlight.large")
       
        // how many suppliers were published?
        let suppliers = await page.$$('div[class="card supplier-card"]');
        //console.log('suppliers # ' + suppliers.length);

        const dateString = du.getISOString(new Date);
        let data = [];
        for (let row = 0; row < suppliers.length; row++) {
            const rowData = {
                asOfDate: dateString,
                supplier: await page.evaluate(el => el.getAttribute('data-supplier'), suppliers[row]),
                rate: await page.evaluate(el => el.getAttribute('data-perkwh'), suppliers[row]),
                term: await page.evaluate(el => el.getAttribute('data-termlength'), suppliers[row]),
                url: await page.evaluate(el => el.getAttribute('data-url'), suppliers[row]),
            };
            data.push(rowData);
        }
        browser.close();
        return resolve(JSON.stringify(data));
    });
}
run().then(console.log).catch(console.error);