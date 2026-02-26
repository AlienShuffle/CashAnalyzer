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

//function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

const debug = false;

const browserPromise = puppeteer.launch({
  headless: true,    // true for production, false for debugging to see the browser.
  defaultViewport: null
});
const browser = await browserPromise;

// this is the main function
// get a list of tickers from stdin, scrape each one, and output facts as JSON to stdout
const rawTickers = readFileSync(0, 'utf8');
const tickers = rawTickers.split('\n').filter(line => line.trim().length > 0);
if (debug) console.error(`Scraping: '${tickers.join(", ")}'`);

let results = [];
for (const ticker of tickers) {
  console.error(`Scraping fund: ${ticker}`);
  // set fund information
  const downloadPath = `./downloads/${ticker}`;
  const url = `https://advisors.vanguard.com/investments/products/${ticker}`;
  const page = await browser.newPage();

  let rowData = {
    "ticker": ticker,
    "source": "advisors.vanguard.com",
    "timestamp": new Date()
  };

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
    //if (debug) console.error(`Exiting selectElement(${selector},${click}) = ''''${found}''''`);
    return found;
  }

  //if (debug) console.error("Opening Vanguard page...");
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
    break; // minimum requriement is to get the yield, if not found, skip the rest of processing for this ticker since it's likely the page structure has changed and other data points may also be missing or incorrect.
  }
  const secYield = (rawSecYield.replace("%", "").trim() / 100).toFixed(4) * 1;
  if (debug) console.error(`rawSecYield= '${rawSecYield}'=${secYield}`);
  const rawSecYieldAsOfDate = await selectElement('span[data-rpa-tag-id="hero-ff-secYield-asOfDate"]', false);
  if (!rawSecYieldAsOfDate) {
    console.error(`No asOfDate found for ticker '${ticker}'`);
    break;
  } else {
    const secYieldAsOfDate = new Date(rawSecYieldAsOfDate.replace("as of ", "")).toISOString().split("T")[0];
    if (debug) console.error(`rawSecYieldAsOfDate='${rawSecYieldAsOfDate}'='${secYieldAsOfDate}'`);
    rowData.thirtyDayYield = secYield.toFixed(4) * 1;
    rowData.asOfDate = secYieldAsOfDate;
  }

  // fund name: #main-content > div.page.small-nav-push > article > section.hero.pdp-hero.container.slim-hero-a.slim-hero-b.slim-hero-c > div > div.col.sm-16.lg-8.pdp-hero__header > div.pdp-hero__header-text > h1 > span
  const rawFundName = await selectElement('span[data-rpa-tag-id="dashboard-longName"]', false);
  if (!rawFundName) {
    console.error(`No rawFundName found for ticker '${ticker}'`);
  } else {
    const fundName = rawFundName.trim();
    if (debug) console.error(`rawFundName= '${rawFundName}'=${fundName}`);
    if (fundName) rowData.accountType = fundName;
  }

  // Expense Ratio
  const rawExpenseRatio = await selectElement('span[data-rpa-tag-id="dashboard-expenseRatio"]', false);
  if (!rawExpenseRatio) {
    console.error(`No rawExpenseRatio found for ticker '${ticker}'`);
  } else {
    const expenseRatio = (rawExpenseRatio.replace("%", "").trim() / 100).toFixed(4) * 1;
    if (debug) console.error(`rawExpenseRatio= '${rawExpenseRatio}'=${expenseRatio}`);
    if (expenseRatio) rowData.expenseRatio = expenseRatio.toFixed(6) * 1;
  }

  // Assets Under Management (AUM)
  const rawAum = await selectElement('span[data-rpa-tag-id="overview-ff-net-assets"]', false);
  if (!rawAum) {
    console.error(`No rawAum found for ticker '${ticker}'`);
  } else {
    const multiplier = rawAum.toLowerCase().includes("b") ? 1e9 : rawAum.toLowerCase().includes("m") ? 1e6 : 1;
    const aum = rawAum.replace(/[^0-9\.]/g, "").trim() * 1;
    if (debug) console.error(`rawAum= '${rawAum}'=${aum}`);
    if (aum) rowData.aum = (aum * multiplier).toFixed(0) * 1;
  }

  // #distributionYield
  const rawDistributionYield = await selectElement('div[id="distributionYield"]', false);
  if (!rawDistributionYield) {
    console.error(`No rawDistributionYield found for ticker '${ticker}'`);
  } else {
    const distributionYield = (rawDistributionYield.replace("DISTRIBUTION YIELD", "").replace(/as of.*$/, "").replace("%", "").trim() / 100).toFixed(4) * 1;
    if (debug) console.error(`rawDistributionYield= '${rawDistributionYield}'=${distributionYield}`);
    if (distributionYield) rowData.distributionYield = distributionYield.toFixed(4) * 1;
  }

  // fundamental fixed income tab -> duration, yield to maturity, efffective maturity, weighted average coupon.
  //#fundamentals-fixed-income-tab-pane-daily 
  const rawFundamentals = await selectElement('#fundamentals-fixed-income-tab-pane-daily', false);
  if (!rawFundamentals) {
    console.error(`No rawFundamentals found for ticker '${ticker}'`);
  } else {
    const lines = rawFundamentals.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (debug) console.error(`rawFundamentals lines: ${lines.join(" | ")}`);

    const durationLineNum = lines.findIndex(l => l.toLowerCase().includes("duration"));
    if (durationLineNum >= 0) {
      const durationLine = lines[durationLineNum].split("\t");
      const durationYears = durationLine[durationLine.length - 1].replace("(years)", "").trim() * 1;
      if (durationYears) rowData.durationYears = durationYears.toFixed(2) * 1;
    }

    const ytmLineNum = lines.findIndex(l => l.toLowerCase().includes("yield to maturity"));
    if (ytmLineNum >= 0) {
      const ytmLine = lines[ytmLineNum].split("\t");
      const yieldToMaturity = ytmLine[ytmLine.length - 1].replace("%", "").trim() / 100;
      if (yieldToMaturity) rowData.yieldToMaturity = yieldToMaturity.toFixed(4) * 1;
    }

    const ytwLineNum = lines.findIndex(l => l.toLowerCase().includes("yield to worst"));
    if (ytwLineNum >= 0) {
      const ytwLine = lines[ytwLineNum].split("\t");
      const yieldToWorst = ytwLine[ytwLine.length - 1].replace("%", "").trim() / 100;
      if (yieldToWorst) rowData.yieldToWorst = yieldToWorst.toFixed(4) * 1;
    }

    const maturityLineNum = lines.findIndex(l => l.toLowerCase().includes("effective maturity"));
    if (maturityLineNum >= 0) {
      const maturityLine = lines[maturityLineNum].split("\t");
      const maturityYears = maturityLine[maturityLine.length - 1].replace("(years)", "").trim() * 1;
      if (maturityYears) rowData.maturityYears = maturityYears.toFixed(2) * 1;
    }

    const wacLineNum = lines.findIndex(l => l.toLowerCase().includes("average coupon"));
    if (wacLineNum >= 0) {
      const wacLine = lines[wacLineNum].split("\t");
      const weightedAverageCoupon = wacLine[wacLine.length - 1].replace("%", "").trim() / 100;
      if (weightedAverageCoupon) rowData.weightedAverageCoupon = weightedAverageCoupon;
    }
  }

  // we have all the facts we need, push to results array.
  results.push(rowData);

  if (!await selectElement('#in-page-section-id-portfolio')) break;
  await sleep(2000);
  if (!await selectElement('.weighted-exposures')) break;
  await sleep(2000);
  if (!await selectElement('#weighted-exposures-tab-issuer-type')) break;
  await sleep(2000);
  if (!await downloadFile("Export issuer type data", downloadPath, `${ticker}-issuer-type.csv`)) break;
  if (debug) console.error("Completed processing for ticker:", ticker);
  await sleep(2000);
  await page.close();
  // do only a few due to rate limiting concerns...
  if (results.length > 5) break;
}

if (debug) console.error("Script complete.");
console.log(JSON.stringify(results));
browser.close();