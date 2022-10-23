const puppeteer = require('puppeteer');
const cloudFunctions = require('@google-cloud/functions-framework');
const NodeCache = require("node-cache");

// The cache used to reduce the number of times we hit the Ally Website.
const cache = new NodeCache();

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
    //console.log("I have a browser");

    // open a new page instance of Chromium.
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    // browse to the Ally savings account page.
    await page.goto("https://www.ally.com/bank/savings-account-rates/");

    // this looks for an element with the current saving account rate.
    var rateValue;
    inputHandle = await page.$("span.allysf-rates-v1-value");
    if (inputHandle != null) {
        rateValue = await page.evaluate(input => input.innerHTML, inputHandle);
        //console.log('rateValue = :' + rateValue + ':');
    }
    inputHandle.dispose();

    let data = {};
    data.Type = "Savings";
    data.Value = +rateValue;
    data.asOf = new Date;

    context.close();;
    return (JSON.stringify(data));
}
/*
 * @param {false} forceRefresh [OPTIONAL, default = FALSE]. true forces a new quote, not use any available cache.
 * @customfunction
 */
async function getCachedAllyQuotes(forceRefresh = false) {
    const cacheKey = 'AllySavings';

    if (!forceRefresh) {
        var cacheVal = cache.get(cacheKey);
        //console.log('cache returned: ' + cacheVal);
        // parse the stored JSON if it exists and return to the caller.
        if (cacheVal != null) {
            //console.log('returning valid cache entry');
            return cacheVal;
        }
    }

    //console.log('cache failed, going out to get new value.');
    var resp = await _getAllyQuotesData();
    //console.log('resp = ' + resp);
    var ttl = 18 * 60 * 60; // 18 hours for now.
    const success = cache.set(cacheKey, resp, ttl);
    //console.log('cache.set results = ' + success);
    return resp;
}

/**
 * Responds to any HTTP request as part of Google Cloud Functions framework.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
 cloudFunctions.http('getAllyQuotes', async (req, res) => {
    //console.log('req.query.message ' + req.query.message);
    //console.log('req.body.message ' + req.body.message);

    // test the NYC time date date info.
    /*
        var currDate = new Date();
        currDate.setSeconds(0);
        currDate.setMilliseconds(0);
        console.log('currDate = ' + currDate);
        console.log('nycDate = ' + _getNYCTime());
    */

    let quote = await getCachedAllyQuotes();

    // log cache hit rates for verification we are getting value for the function.
    console.log('cache stats =' + JSON.stringify(cache.getStats()));

    //console.log("main after stringify, message = :" + quote + ':');
    res.status(200).send(quote);
});



// These are future functions for the CashAnalyzer library module. Just getting code to work for now.
function _getNYCTime() {
    // current date in local timezone with seconds trimmed.
    var currDate = new Date();
    currDate.setSeconds(0);
    currDate.setMilliseconds(0);

    // This is considered unsafe, but it appears to work.
    // It basically gets a string representing the current time in NYC timezone regardless of
    // the current time zone defined in the user's environment and converts to a new Date thus showing the
    // local time as it is seen in NYC, not here, wherever here is.....
    var nycDateString = currDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
    //console.log('nycDateString = ' + nycDateString);
    return new Date(Date.parse(nycDateString));
}