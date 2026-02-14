const puppeteer = require("puppeteer");
const du = require('../lib/dateUtils.js');

// shared global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']
    args: ['--window-size=1400,900']
    //args: ['--window-size=800,600', '--no-sandbox']
});

function run() {
    return new Promise(async (resolve, reject) => {
        const browser = await browserPromise;

        // open a new page instance of Chromium.
        const page = await browser.newPage();

        // browse to the marketable securities page
        // alternative url is:
        await page.goto("https://institutional.fidelity.com/app/fund/sasid/details/458.html");

        console.log('looking for View All.')
        // find the View All tab header
        let inputHandle = await page.$("#fundTabviewAll > a");

        console.log('clicking View All.')
        const [reponseViewAll] = await Promise.all([
            //page.waitForNavigation(),
            page.click("#fundTabviewAll > a"),
        ]);

        console.log('waiting for history.')
        inputHandle = await page.$("#bricklet_histPriceDistribYld_80_table_2_tr07 > td > a:nth-child(6)");
        console.log('click 5year history.')
        // click the input button and wait for the page to navigate to results.
        const [responseHistory] = await Promise.all([
            //page.waitForNavigation(), // The promise resolves after navigation has finished
            page.click("#bricklet_histPriceDistribYld_80_table_2_tr07 > td > a:nth-child(6)"),
        ]);

        // Price/Yields Button: document.querySelector("#bricklet_histPriceDistribYld_80_form > div > a")
        console.log('waiting for Price/yield button.')
        inputHandle = await page.$("#bricklet_histPriceDistribYld_80_form > div > a");
        console.log('click price/yield.')
        // click the input button and wait for the page to navigate to results.
        const [responsePriceYield] = await Promise.all([
            //page.waitForNavigation(), // The promise resolves after navigation has finished
            page.click("#bricklet_histPriceDistribYld_80_form > div > a"),
        ]);

        console.log('awaiting table.')
        ///html/body/main/div[3]/div[1]/div/div[7]/div[1]/div/div[5]/div[4]/div/section/div[2]/div/div/div[3]/table
        //
        //inputHandle = await page.$("id.bricklet_histPriceDistribYldMnyMkt_82_table_1");
        inputHandle = await page.$("tbody");
       
        console.log(inputHandle)
        // get the html string for this table and log it.
       // const tableValue = await page.evaluate(input => input.innerHTML, inputHandle);
       // console.error(tableValue);

       
        console.log('lets parse table.')
        // how many quotes were published?
        //#bricklet_histPriceDistribYldMnyMkt_82_table_2_tr01
        let rows = await page.$$('[id*="histPriceDistribYldMnyMkt_82_table_2"');
        const rawHeader = await page.evaluate(input => input.innerHTML, rows[0]);
        console.error('rows = ' + rows.length);
        console.log(rawHeader)

        // create the headers list for JSON tags.
/*
        var headers = [];
        let cols = await rows[0].$$('thead');
        console.log('cols=' + cols.length)
        for (let col = 0; col < cols.length; col++) {
            const rawHeader = await page.evaluate(input => input.innerHTML, cols[col]);
            headers[col] = rawHeader.toLowerCase().replace(/ /gi, '');
            console.error(headers[col]);
        }
*/

        //const asOfDate = du.getISOString(new Date(yearValue * 1, monthValue * 1 - 1, dayValue * 1));
        // This parses the rate table and puts in an array for conversion to JSON.
        let data = [];
        for (let row = 1; row < rows.length; row++) {
            //console.error('row[' + row + '] = ' + await page.evaluate(input => input.innerHTML, rows[row]));
            // get an array of all the columns for the current row.
            cols = await rows[row].$$('td');
            console.error('cols = ' + cols.length);
            let rowData = {};
            for (let col = 0; col < cols.length; col++) {
                const value = await page.evaluate(input => input.innerHTML, cols[col]);
                rowData[col] = value;
            }
            data.push(rowData);
        }

        //console.error('data Rows = ' + data.length);
        //await browser.close();
        return resolve(JSON.stringify(data));
    });
}
run() // .then(console.log).catch(console.error);