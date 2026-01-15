import puppeteer from "puppeteer";
import {
  readFileSync,
  readdirSync,
  renameSync,
  statSync
} from "fs";
import {
  join
} from "node:path";

const debug = false;

const browserPromise = puppeteer.launch({
  headless: false,
  defaultViewport: null
});
const browser = await browserPromise;

// this is the main function
const rawTickers = readFileSync(0, 'utf8');
const tickers = rawTickers.split('\n').filter(line => line.trim().length > 0);
let results = [];
for (const ticker of tickers) {
  console.error(`Processing fund: ${ticker}`);
  // set fund information
  const downloadPath = `./downloads/${ticker}`;
  const url = `https://advisors.vanguard.com/investments/products/${ticker}`;
  const page = await browser.newPage();

  async function exportButtonFinder(matchText) {
    if (debug) console.error(`Searching for button: '${matchText}'`);

    const exportButtonHandle = await page.evaluateHandle((matchText) => {
      return Array.from(document.querySelectorAll("button"))
        .find(btn => btn.textContent.trim() === matchText) || null;
    }, matchText);

    if (!exportButtonHandle) {
      console.error(`Button with text '${matchText}' not found.`);
      return null;
    }
    return exportButtonHandle.asElement();
  }

  function sleep(ms) {
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

  async function downloadFile(buttonText, downloadPath, csvFileName) {
    const exportButton = await exportButtonFinder(buttonText);
    if (!exportButton) {
      console.error(`Button with text '${buttonText}' not found.`);
      return false;
    }
    await page._client().send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadPath
    });
    await exportButton.focus();
    await exportButton.click();

    if (debug) console.error("Waiting for CSV download...");
    await waitForDownloadComplete(downloadPath);
    await renameLatestFile(downloadPath, csvFileName);
    return true;
  }

  async function selectElement(selector, click = true) {
    if (debug) console.error(`Selecting element '${selector}'`);
    const found = await page.evaluate((selector, click) => {
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView();
        el.focus();
        if (click) el.click();
        return el.innerText;
      } else {
        return null;
      }
    }, selector, click);
    if (debug) console.error(`Exiting selectElement(${selector},${click}) = ''''${found}''''`);
    return found;
  }

  if (debug) console.error("Opening Vanguard page...");
  await page.goto(
    url,
    { waitUntil: "networkidle2" }
  );

    // download distributions data
  if (!await selectElement('.distribution-table')) break;
  await sleep(2000);
  if (!await selectElement('button[class="button button--black"]', false)) break;
  await sleep(2000);
  if (!await downloadFile("Export distribution data", downloadPath, `${ticker}-distributions.csv`)) break;

  //await downloadFile("Export full holdings", downloadPath, `${ticker}-holdings.csv`);

  //document.querySelector("#in-page-section-id-portfolio")
  // class = .
  // id = #

  // now get thirty day yield and as of date
  const rawSecYield = await selectElement('span[data-rpa-tag-id="hero-ff-secYield-pct"]', false);
  if (!rawSecYield) {
    console.error(`No thirtyDayYield found for ticker '${ticker}'`);
    break;
  }
  const secYield = (rawSecYield.replace("%", "").trim() / 100).toFixed(4) * 1;
  if (debug) console.error(`rawSecYield= '${rawSecYield}'=${secYield}`);
  const rawSecYieldAsOfDate = await selectElement('span[data-rpa-tag-id="hero-ff-secYield-asOfDate"]', false);
  if (!rawSecYieldAsOfDate) {
    console.error(`No asOfDate found for ticker '${ticker}'`);
    break;
  }
  const secYieldAsOfDate = new Date(rawSecYieldAsOfDate.replace("as of ", "")).toISOString().split("T")[0];
  if (debug) console.error(`rawSecYieldAsOfDate='${rawSecYieldAsOfDate}'='${secYieldAsOfDate}'`);

  // Distribution Yield

  const rawExpenseRatio = await selectElement('span[data-rpa-tag-id="dashboard-expenseRatio"]', false);
  if (!rawExpenseRatio) {
    console.error(`No rawExpenseRatio found for ticker '${ticker}'`);
    break;
  }
  const expenseRatio = (rawExpenseRatio.replace("%", "").trim() / 100).toFixed(4) * 1;
  if (debug) console.error(`rawExpenseRatio= '${rawExpenseRatio}'=${expenseRatio}`);
  
  results.push({
    "ticker": ticker,
    "thirtyDayYield": secYield,
    "asOfDate": secYieldAsOfDate,
    "expenseRatio": expenseRatio,
    "source": "advisors.vanguard.com",
    "timestamp": new Date()
  });

  if (!await selectElement('#in-page-section-id-portfolio')) break;
  await sleep(2000);
  if (!await selectElement('.weighted-exposures')) break;
  await sleep(2000);
  if (!await selectElement('#weighted-exposures-tab-issuer-type')) break;
  await sleep(2000);
  if (!await downloadFile("Export issuer type data", downloadPath, `${ticker}-issuer-type.csv`)) break;
  if (true) console.error("Completed processing for ticker:", ticker);
  await sleep(2000);
  await page.close();
  // do only a few due to rate limiting concerns...
  if (results.length > 5) break;
}

if (debug) console.error("Script complete.");
console.log(JSON.stringify(results));
browser.close();

// grep '^[a-zA-Z]' VTEC-distributions.csv