import puppeteer from "puppeteer";

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

        await page.goto("https://www.schwabassetmanagement.com/products/money-fund-yields");

        let dateHandle = await page.$("#marquee-text--money_fund_yields > div.skin-2 > div > div > div > div > div")
        // does not work let dateHandle = await page.$$('div[csim-subheading marquee-text__description]');
        //console.error(dateHandle);
        let asOfDateString = (await page.evaluate(input => input.innerHTML, dateHandle)).trim();
        const yrStr = asOfDateString.substring(asOfDateString.length - 2, asOfDateString.length);
        const dayStr = asOfDateString.substring(asOfDateString.length - 5, asOfDateString.length - 3);
        const monStr = asOfDateString.substring(asOfDateString.length - 8, asOfDateString.length - 6);
        //console.error('strings = ' + monStr + ':' + dayStr + ':' + yrStr);
        //const asOfDate = new Date(yrStr * 1, monStr - 1, dayStr * 1);
        //console.error('asOfDate = ' + asOfDate);
        const asOfISO = '20' + yrStr + '-' + monStr + '-' + dayStr;

        // how many quotes were published?
        let rows = await page.$$('tr');
        //console.error('rows = ' + rows.length);

        // This parses the rate table and puts in an array for conversion to JSON.
        let timestamp = new Date;
        let data = [];
        for (let row = 1; row < rows.length; row++) {
            // get an array of all the columns for the current row.
            const cols = await rows[row].$$('td');
            //console.error('cols = ' + cols.length);
            let rowData = {};
            for (let col = 0; col < cols.length; col++) {
                const value = await page.evaluate(input => input.innerHTML, cols[col]);
                switch (col) {
                    case 0:
                        rowData.accountType = value.replace(/<(?:.|\n)*?>/gm, '').trim();
                        break;
                    case 1:
                        rowData.ticker = value.trim();
                        break;
                    case 2:
                        rowData.sevenDayYield = (parseFloat(value.trim()) / 100).toFixed(4) * 1;
                        break;
                    case 6:
                        rowData.expenseRatio = (parseFloat(value.trim()) / 100).toFixed(4) * 1;
                        break;
                    default:
                        //console.error('col[' + col + ']=' + value);
                        break;
                }
            }
            rowData.asOfDate = asOfISO;
            rowData.price = 1;
            rowData.source = 'schwab.com';
            rowData.timestamp = timestamp;
            if (rowData.sevenDayYield > 0) data.push(rowData);
        }
        //console.error('data Rows = ' + data.length);
        await browser.close();
        return resolve(JSON.stringify(data));
    });
}
run().then(console.log).catch(console.error);