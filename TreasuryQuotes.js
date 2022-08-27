// testing This is the Node version that will work locally
const puppeteer = require("puppeteer");

async function getTreasuryQuotes() {
    const browser = await puppeteer.launch({
        defaultViewport: null,
        headless: false,  // comment out to make this run headless for production.
        ignoreDefaultArgs: ['--disable-extensions'],
        //args: ['--window-size=1920,1080']
        args: ['--window-size=800,600']
    });

    // open an instance of Chromium.
    const page = await browser.newPage();

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

    let rows = await inputHandle.$$('tr');
    console.log('rows = ' + rows.length);

    // create the headers list
    var headers = [];
    let cols = await rows[0].$$('th');
    for (let col = 0; col < cols.length; col++) {3
        const rawHeader = await page.evaluate(input => input.innerHTML, cols[col]);
        headers[col] = rawHeader.toLowerCase().replace(/ /gi, '');
        console.log(headers[col]);
    }

    let data = [];
    for (let row = 1; row < rows.length; row++) {
        console.log('row[' + row + '] = ' + await page.evaluate(input => input.innerHTML, rows[row]));



        // get an array of all the columns for the current row.
        cols = await rows[row].$$('td');
        console.log('cols = ' + cols.length);

        if (cols.lenghth == 8) {
            var rowData = {};
            for (let col = 0; col < cols.length; col++) {
                rowData[headers[col]] = await page.evaluate(input => input.innerHTML, cols[col]);
            }
            data.push(rowData);
        }

    }
    console.log(JSON.stringify(data));
    await inputHandle.dispose();
    await browser.close();
    console.log('closed');
}
getTreasuryQuotes();


// this would test the function below, but id does not work.
//console.log(JSON.stringify(tableToJson(tableValue)));

// this function does not work!
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
