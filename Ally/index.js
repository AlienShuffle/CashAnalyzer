const puppeteer = require('puppeteer');
const functions = require('@google-cloud/functions-framework');

// shared global browser instance.
let browserPromise = puppeteer.launch({
    defaultViewport: null,
    //headless: false,  // comment out to make this run headless for production.
    ignoreDefaultArgs: ['--disable-extensions'],
    //args: ['--window-size=1920,1080']
    args: ['--window-size=800,600', '--no-sandbox']
});

async function _getAllyQuotesData() {
    const browser = await browserPromise;
    console.log("I have a browser");

    // open a new page instance of Chromium.
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    // browse to the Ally savings account page.
    await page.goto("https://www.ally.com/bank/savings-account-rates/");

    // this looks for an element with the current saving account rate.
    var rateValue;
    inputHandle = await page.$("span.allysf-rates-v1-value");
    if (inputHandle != null) {
        console.log('handle = ', inputHandle);
        rateValue = await page.evaluate(input => input.innerHTML, inputHandle);
        console.log('2 rateValue = :' + rateValue + ':');
    }
    inputHandle.dispose();

    let data = {};
    data['Type'] = "Savings";
    data['Value'] = +rateValue;
    data['asOf'] = new Date;

    context.close();;
    return(JSON.stringify(data));
}

/**
 * Responds to any HTTP request as part of Google Cloud Functions framework.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
functions.http('getAllyQuotes', async (req, res) => {
    //console.log('req.query.message ' + req.query.message);
    //console.log('req.body.message ' + req.body.message);
    console.log("step 1");
    let quote = await _getAllyQuotesData();

    console.log("main after stringify, message = :" + quote + ':');
    res.status(200).send(quote);
    console.log("exit");
});