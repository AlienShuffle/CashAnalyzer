//const du = require('../lib/dateUtils.js');
import { duGetISOString } from "../lib/dateUtils.mjs";

import puppeteer from "puppeteer";

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

        // browse to the marketable securities page
        await page.goto("http://online.wsj.com/mdc/public/page/2_3020-tips.html?mod=mdc_bnd_pglnk");

        let inputHandle;
        inputHandle = await page.$("span.WSJBase--card__timestamp--3F2HxyAE");
        // actual timestamp.
        const timestampString = await page.evaluate(input => input.innerHTML, inputHandle);
        //console.log("timestamp = " + timestampString);
        const timestamp = new Date(timestampString);

        // retrieve the table and process it.
        //#root > div > div > div > div:nth-child(2) > div > div > div.WSJBase--card__header--2HEEgORG.WSJTheme--card__header--3OnZXE_M > div > span

        inputHandle = await page.$("#root > div > div > div > div:nth-child(2) > div > div > div.WSJTables--tableWrapper---SfLdzv7.WSJBase--card--2XHo-8Ej > table");
        // find the table with the price quotes.
        inputHandle = await page.$("table.WSJTables--table--1QzSOCfq");
        // get the html string for this table and log it.
        //const tableValue = await page.evaluate(input => input.innerHTML, inputHandle);
        //console.log(tableValue);

        // how many quotes were published?
        let rows = await inputHandle.$$('tr');
        //console.log('rows = ' + rows.length);

        // create the headers list for JSON tags.
        let headers = [];
        let cols = await rows[0].$$('th');
        for (let col = 0; col < cols.length; col++) {
            const rawHeader = await page.evaluate(input => input.innerHTML, cols[col]);
            headers[col] = rawHeader.toLowerCase().replace(/ /gi, '').replace(/\*/g, '');
            //console.log(headers[col]);
        }
        //console.log("# cols = " + cols.length);

        // This parses the rate table and puts in an array for conversion to JSON.
        let data = [];
        for (let row = 1; row < rows.length; row++) {
            // get an array of all the columns for the current row.
            cols = await rows[row].$$('td');
            //console.log('cols = ' + cols.length);

            if (cols.length == 7) {
                var rowData = {};
                rowData['asOfDate'] = duGetISOString(timestamp);
                for (let col = 0; col < cols.length; col++) {
                    const value = await page.evaluate(input => input.innerHTML, cols[col]);
                    switch (headers[col]) {
                        case 'maturity':
                            // convert to proper JSON format (YYYY-MM-DD)
                            rowData[headers[col]] = duGetISOString(new Date(value));
                            break;
                        case 'coupon':
                        case 'yield':
                            // convert to decimal value so spreadsheets and just treat as a percentage.
                            rowData[headers[col]] = (value / 100).toFixed(5) * 1;
                            break;
                        case 'bid':
                        case 'asked':
                            // quoted in WSJ in 32nds after decimal point, need to move to base 10!
                            rowData[headers[col]] = (Math.trunc(value) + (100 * (value % 1)) / 32).toFixed(5) * 1;
                            break;
                        case 'chg':
                        case 'accruedprincipal':
                            // some values are reported as unchanged, make that zero.
                            rowData[headers[col]] = (value == 'unch.') ? 0 : value * 1;
                            break;
                    }
                }
                data.push(rowData);
            }
        }
        //console.log('data Rows = ' + data.length);
        browser.close();
        return resolve(JSON.stringify(data));
    });
}
run().then(console.log).catch(console.error);