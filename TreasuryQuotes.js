const puppeteer = require("puppeteer");

(async function main() {
    const browser = await puppeteer.launch({
        defaultViewport: null,
        headless: false,
        ignoreDefaultArgs: ['--disable-extensions'],
        //args: ['--window-size=1920,1080']
        args: ['--window-size=800,600']
    });

    const page = await browser.newPage();
    // this is the URL for the marketable securities page
    await page.goto("https://savingsbonds.gov/GA-FI/FedInvest/selectSecurityPriceDate");

    // this looks for an element <input>, with id attribute priceDate.xxxx 
    // and returns the contents of the attribute 'value'.
    let inputHandle = await page.$("[id='priceDate.month']");
    const monthValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    inputHandle = await page.$("[id='priceDate.day']");
    const dayValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    inputHandle = await page.$("[id='priceDate.year']");
    const yearValue = await page.evaluate(input => input.value, inputHandle);
    await inputHandle.dispose();
    console.log(monthValue + '/' + dayValue + '/' + yearValue);

    // click the input button and wait for the page to navigate to results.
    const [response] = await Promise.all([
        page.waitForNavigation(), // The promise resolves after navigation has finished
        page.click('input.action'), // Clicking the link will indirectly cause a navigation
    ]);
    console.log('look for full content');
    inputHandle = await page.$("table.data1");
    const tableValue = await page.evaluate(input => input.innerHTML, inputHandle);
    //console.log(tableValue);
    //console.log(JSON.stringify(tableToJson(tableValue)));
    let rows = await inputHandle.$$('tr');
    console.log('rows = ' + rows.length);
    await inputHandle.dispose();
    await browser.close();
    console.log('closed');


})();


// this function does not work!s
function tableToJson(table) {
    var data = [];

    // first row needs to be headers
    var headers = [];
    for (var i = 0; i < table.rows[0].cells.length; i++) {
        headers[i] = table.rows[0].cells[i].innerHTML.toLowerCase().replace(/ /gi, '');
    }

    // go through cells
    for (var i = 1; i < table.rows.length; i++) {

        var tableRow = table.rows[i];
        var rowData = {};

        for (var j = 0; j < tableRow.cells.length; j++) {

            rowData[headers[j]] = tableRow.cells[j].innerHTML;

        }

        data.push(rowData);
    }

    return data;
}
