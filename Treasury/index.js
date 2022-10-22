
const puppeteer = require("puppeteer");
const functions = require('@google-cloud/functions-framework');

// shared global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    //headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']
    args: ['--window-size=800,600', '--no-sandbox']
});

async function _getTreasuryQuotes() {
    const browser = await browserPromise;
    console.log("I have a browser");

    // open a new page instance of Chromium.
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    // browse to the marketable securities page
    await page.goto("https://savingsbonds.gov/GA-FI/FedInvest/selectSecurityPriceDate");

    // this looks for an elements <input>, with id attribute priceDate.xxxx 
    // and stores the contents of the attribute 'value'.
    let inputHandle = await page.$("[id='priceDate.month']");
    const monthValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    inputHandle = await page.$("[id='priceDate.day']");
    const dayValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    inputHandle = await page.$("[id='priceDate.year']");
    const yearValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    // do something with the date we found (the last date with valid prices)
    console.log(monthValue + '/' + dayValue + '/' + yearValue);

    // click the input button and wait for the page to navigate to results.
    const [response] = await Promise.all([
        page.waitForNavigation(), // The promise resolves after navigation has finished
        page.click('input.action'), // Clicking the link will indirectly cause a navigation
    ]);
    console.log('look for full content');

    // find the table with the price quotes.
    inputHandle = await page.$("table.data1");
    // get the html string for this table and log it.
    const tableValue = await page.evaluate(input => input.innerHTML, inputHandle);
    //console.log(tableValue);

    // how many quotes were published?
    let rows = await inputHandle.$$('tr');
    console.log('rows = ' + rows.length);

    // create the headers list for JSON tags.
    var headers = [];
    let cols = await rows[0].$$('th');
    for (let col = 0; col < cols.length; col++) {
        const rawHeader = await page.evaluate(input => input.innerHTML, cols[col]);
        headers[col] = rawHeader.toLowerCase().replace(/ /gi, '');
        console.log(headers[col]);
    }

    // This parses the rate table and puts in an array for conversion to JSON.
    let data = [];
    for (let row = 1; row < rows.length; row++) {
        //console.log('row[' + row + '] = ' + await page.evaluate(input => input.innerHTML, rows[row]));
        // get an array of all the columns for the current row.
        cols = await rows[row].$$('td');
        //console.log('cols = ' + cols.length);

        if (cols.length == 8) {
            var rowData = {};
            for (let col = 0; col < cols.length; col++) {
                rowData[headers[col]] = await page.evaluate(input => input.innerHTML, cols[col]);
                //console.log('rowData[' + headers[col] + '] = ' + rowData[headers[col]]);
            }
            data.push(rowData);
        }
    }
    console.log('data Rows = ' + data.length);

    await inputHandle.dispose();
    await context.close();
    console.log('page/context closed');
    return (JSON.stringify(data));
}

/*
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
functions.http('getTreasuryQuotes', async (req, res) => {
    console.log('calling _getTreasuryQuotes');
    const message = await _getTreasuryQuotes();
    //console.log('set reponse: '+ message);
    res.status(200).send(message);
});