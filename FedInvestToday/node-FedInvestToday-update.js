const puppeteer = require("puppeteer");
const du = require('../lib/dateUtils.js');

// shared global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']
    args: ['--window-size=800,600', '--no-sandbox']
});

function run() {
    return new Promise(async (resolve, reject) => {
        const browser = await browserPromise;

        // open a new page instance of Chromium.
        const page = await browser.newPage();

        // browse to the marketable securities page
        await page.goto("https://treasurydirect.gov/GA-FI/FedInvest/todaySecurityPriceDetail");
        await page.waitForSelector('h2');
        // grab the current days price date.
        let h2s = await page.$$('h2');
        let dateString = '';
        const legendString = 'Prices For: ';
        for (let i = 0; i < h2s.length; i++) {
            const text = await page.evaluate(input => input.innerHTML, h2s[i]);
            const index = text.indexOf(legendString);
            if (index >= 0) {
                dateString = text.substring(legendString.length);
                console.error('dateString = "' + dateString + '"');
                break;
            }
        }
        if (dateString == '') {
            await browser.close();
            return reject("Today's prices not yet published.");
        }
        // find the table with the price quotes.
        let inputHandle = await page.$("table.data1");
        // how many quotes were published?
        let rows = await inputHandle.$$('tr');
        //console.error('rows = ' + rows.length);

        // create the headers list for JSON tags.
        var headers = [];
        let cols = await rows[0].$$('th');
        for (let col = 0; col < cols.length; col++) {
            const rawHeader = await page.evaluate(input => input.innerHTML, cols[col]);
            headers[col] = rawHeader.toLowerCase().replace(/ /gi, '');
            //console.error(headers[col]);
        }

        const asOfDate = du.getISOString(new Date((dateString == '') ? "1/1/1900" : dateString));
        // This parses the rate table and puts in an array for conversion to JSON.
        let data = [];
        for (let row = 1; row < rows.length; row++) {
            //console.error('row[' + row + '] = ' + await page.evaluate(input => input.innerHTML, rows[row]));
            // get an array of all the columns for the current row.
            cols = await rows[row].$$('td');
            //console.error('cols = ' + cols.length);

            if (cols.length == 8) {
                var rowData = { asOfDate: asOfDate };
                for (let col = 0; col < cols.length; col++) {
                    const value = await page.evaluate(input => input.innerHTML, cols[col]);
                    switch (headers[col]) {
                        case 'maturitydate':
                            rowData[headers[col]] = du.getISOString(new Date(value));
                            break;
                        case 'rate':
                            rowData[headers[col]] = (parseFloat(value) / 100).toFixed(5);
                            break;
                        default:
                            rowData[headers[col]] = value;
                            break;
                    }
                }
                rowData.key = rowData.maturitydate + '-' + rowData.rate;
                data.push(rowData);
            }
        }
        //console.error('data Rows = ' + data.length);
        await browser.close();
        return resolve(JSON.stringify(data));
    });
}
run().then(console.log).catch(console.error);