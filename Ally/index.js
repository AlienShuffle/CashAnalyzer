/*
const puppeteer = require("puppeteer");

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
    // and stores the contents of the attribute 'value'.
    let inputHandle = await page.$("[class='allysf-rates-v1-value']");
    const rateValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    // do something with the date we found (the last date with valid prices)
    console.log('rateValue = :' + rateValue + ':');

    let data = [];
    data['Type'] = "Savings";
    data['Value'] = rateValue;
    data['asOf'] = new Date;


    await page.close();
    console.log(JSON.stringify(data));
    //await browser.close();
    console.log('page closed');
}
*/

/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
 exports.getAllyQuotes = (req, res) => {
    let message = req.query.message || req.body.message || 'Hello World from getAllyQuotes\n';
    res.status(200).send(message);
  }