import puppeteer from "puppeteer";
import {
    readdirSync,
    renameSync,
    statSync
} from "fs";
import {
    join
} from "node:path";

const debug = false;

const browserPromise = puppeteer.launch({
    headless: true,
    args: ['--window-size=1920,1080'],  // big screen layout for CSV export.
    defaultViewport: null
});
const browser = await browserPromise;

// this is the main function
const ticker = "BOXX";
const downloadPath = `./downloads/${ticker}`;
const url = `https://funds.alphaarchitect.com/boxetf/`;
const page = await browser.newPage();

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: wait until no .crdownload files remain
async function waitForDownloadComplete(dir) {
    // make sure download starts
    await sleep(800);
    // return once the .crdownload file is removed (completed).
    return new Promise(resolve => {
        const interval = setInterval(() => {
            const files = readdirSync(dir);
            const downloading = files.some(f => f.endsWith(".crdownload"));
            if (!downloading) {
                clearInterval(interval);
                resolve();
            }
        }, 500);
    });
}

// Helper: rename the most recently downloaded file
async function renameLatestFile(downloadDir, newName) {
    const files = readdirSync(downloadDir)
        .filter(f => !f.endsWith(".crdownload"))
        .sort((a, b) => statSync(join(downloadDir, b)).mtimeMs -
            statSync(join(downloadDir, a)).mtimeMs);

    if (files.length === 0) return null;

    const oldPath = join(downloadDir, files[0]);
    const newPath = join(downloadDir, newName);
    renameSync(oldPath, newPath);
    if (debug) console.error("Renamed file:", newPath);
    return newPath;
}

async function downloadFile(selector, downloadPath, csvFileName) {
    const button = await selectElement(selector);

    if (!button) {
        console.error(`Button '${selector}' not found.`);
        return false;
    }

    await page._client().send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadPath
    });

    if (debug) console.error("Clicking CSV button...");
    await button.click();

    if (debug) console.error("Waiting for CSV download...");
    await waitForDownloadComplete(downloadPath);
    await renameLatestFile(downloadPath, csvFileName);

    return true;
}

async function selectElement(selector) {
    if (debug) console.error(`Selecting element '${selector}'`);
    await page.waitForSelector(selector, { visible: true });
    const handle = await page.$(selector);
    if (handle) {
        await handle.evaluate(el => el.scrollIntoView());
        return handle;
    }
    return null;
}

async function getElementText(selector) {
    if (debug) console.error(`Selecting element '${selector}'`);
    const found = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (el) {
            el.scrollIntoView();
            el.focus();
            return el.innerText;
        } else {
            return null;
        }
    }, selector);
    if (debug) console.error(`Exiting getElementText(${selector}) = '''${found}'''`);
    return found;
}

if (debug) console.error("Opening BOXX page...");
await page.goto(
    url,
    { waitUntil: "networkidle2" }
);

//document.querySelector("#in-page-section-id-portfolio")
// class = .
// id = #

// Now get thirty day Option Expiration yield and as of date
// #table_1 > tbody > tr.odd.detail-show > td.numdata.float.column-average-yield-to-option-expiration
const rawExprYield = await getElementText('td.numdata.float.column-average-yield-to-option-expiration');
if (!rawExprYield) {
    console.error(`No Yield to Option Expiration found for BOXX.`);
    process.exit()
}
const exprYield = (rawExprYield.replace("%", "").trim() / 100).toFixed(4) * 1;
if (debug) console.error(`rawYield= '${rawExprYield}'=${exprYield}`);

// #table_1 > tbody > tr > td.column-as-of-date
const rawYieldAsOfDate = await getElementText('td.column-as-of-date');
if (!rawYieldAsOfDate) {
    console.error(`No asOfDate found for BOXX`);
    process.exit()
}
const yieldAsOfDate = new Date(rawYieldAsOfDate).toISOString().split("T")[0];
if (debug) console.error(`rawYieldAsOfDate='${rawYieldAsOfDate}'='${yieldAsOfDate}'`);

// #table_205_row_0 > td.expand.numdata.float.column-total_exp
const rawExpenseRatio = await getElementText('td.expand.numdata.float.column-total_exp');
if (!rawExpenseRatio) {
    console.error(`No rawExpenseRatio found for ticker '${ticker}'`);
    process.exit()
}
const expenseRatio = (rawExpenseRatio.replace("%", "").trim() / 100).toFixed(4) * 1;
if (debug) console.error(`rawExpenseRatio= '${rawExpenseRatio}'=${expenseRatio}`);

// #table_1 > tbody > tr.odd.detail-show > td.expand.numdata.integer.column-average-days-to-option-expiration
const rawDurationDays = await getElementText('td.expand.numdata.integer.column-average-days-to-option-expiration');
if (!rawDurationDays) {
    console.error(`No rawDurationDays found for ticker '${ticker}'`);
    process.exit()
}
const durationDays = parseInt(rawDurationDays.replace(/ Days$/, ""));
const durationYears = (durationDays / 365).toFixed(4) * 1;
if (debug) console.error(`rawDurationDays= '${rawDurationDays}'=${durationDays}`);

const results = [];
results.push({
    "ticker": ticker,
    "thirtyDayYield": exprYield,
    "asOfDate": yieldAsOfDate,
    "expenseRatio": expenseRatio,
    "durationYears": durationYears,
    "source": "alphaarchitect.com",
    "timestamp": new Date()
});
console.log(JSON.stringify(results));

// Now get distribution data by clicking the download button and parsing the resulting CSV file.
// this will be processed in a later script.
//
// #fund-distributions > h1
if (!await selectElement('#fund-distributions')) process.exit();
await sleep(1000);

// find the export button and expose the CSV download button.
// #table_18_wrapper > div.dt-buttons > button.dt-button.buttons-collection.DTTT_button.DTTT_button_export
const exportButton = await selectElement('#table_18_wrapper > div.dt-buttons > button.dt-button.buttons-collection.DTTT_button.DTTT_button_export > span:nth-child(1)');
if (!exportButton) {
    console.error(`No export button found for BOXX.`);
    process.exit();
}
exportButton.click();
await sleep(1000);

// click the CSV download button in the dropdown menu that appears after clicking the export button. this will download the file.
// #table_18_wrapper > div.dt-buttons > div.dt-button-collection.dtb-b3.wdt-skin-aqua > div > button.dt-button.buttons-csv.buttons-html5
if (!await downloadFile("#table_18_wrapper > div.dt-buttons > div.dt-button-collection.dtb-b3.wdt-skin-aqua > div > button.dt-button.buttons-csv.buttons-html5", downloadPath, `${ticker}-distributions.csv`)) process.exit();

if (debug) console.error("Script complete.");
browser.close();