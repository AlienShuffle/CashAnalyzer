const puppeteer = require('puppeteer');
const functions = require('@google-cloud/functions-framework');

// shared global browser instance.
var browser = null;

async function GetAllyQuotesData() {
    if (!browser) {
        browser = await puppeteer.launch({
            defaultViewport: null,
            headless: false,  // comment out to make this run headless for production.
            ignoreDefaultArgs: ['--disable-extensions'],
            //args: ['--window-size=1920,1080']
            args: ['--window-size=800,600']
        });
        console.log('browser started');
    }

    // open an  new page instance of Chromium.
    const page = await browser.newPage();

    // browse to the marketable securities page
    await page.goto("https://www.ally.com/bank/savings-account-rates/");

    // this looks for an elements <input>, with id attribute priceDate.xxxx 
    // and stores the contents of thes attribute 'value'.
    let inputHandle = await page.$("span.allysf-rates-v1-value");
    console.log('handle = ', inputHandle);
    const rateValue = await page.evaluate(input => input.value, inputHandle);

    // do something with the date we found (the last date with valid prices)
    console.log('rateValue = :' + rateValue + ':');

    let data = {};
    data['Type'] = "Savings";
    data['Value'] = +rateValue;
    data['asOf'] = new Date;
    await inputHandle.dispose();

    //await page.close();;
    //await browser.close();
    //console.log('page closed');
    let json = JSON.stringify(data);
    console.log('json = '+ json);
    return json;
}

/**
 * Responds to any HTTP request as part of Google Cloud Functions framework.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
functions.http('getAllyQuotes', async (req, res) => {
    console.log('req.query.message ' + req.query.message);
    console.log('req.body.message ' + req.body.message);
    console.log("step 1");
    let quote = await GetAllyQuotesData();
    
    console.log("main after stringify, message = :" + quote + ':');
    res.status(200).send(quote);
    console.log("exit");
});