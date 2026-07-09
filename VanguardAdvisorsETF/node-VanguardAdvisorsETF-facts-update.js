import puppeteer from "puppeteer";
import {
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  mkdirSync,
  existsSync
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

  async function clickButtonByText(matchText) {
    return await clickElementByText(matchText, ["button"]);
  }

  async function clickElementByText(matchText, tags = ["button", "a"]) {
    if (debug) console.error(`Clicking element: '${matchText}' using tags [${tags.join(', ')}]`);
    const result = await page.evaluate((matchText, tags) => {
      const normalizedTarget = matchText.replace(/\s+/g, " ").trim().toLowerCase();
      const selector = tags.join(",");
      const el = Array.from(document.querySelectorAll(selector))
        .find(node => (node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase() === normalizedTarget);
      if (!el) return false;
      el.scrollIntoView();
      el.click();
      return true;
    }, matchText, tags);
    if (debug) console.error(`clickElementByText('${matchText}') returned ${result}`);
    return result;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const fixedIncomeTabTexts = [
    'Fixed income',
    'Fixed Income',
    'Fixed-income',
    'Fixed Income ›',
    'Fixed income ›'
  ];

  const fixedIncomePanelSelectors = [
    'section.fundamentals-data',
    '[data-rpa-tag-id="fundamentals-fixed-income-tab-pane-daily"]',
    '#fundamentals-fixed-income-tab-pane-daily',
    'div[id^="axs-tabs-"][id$="-panel-0"]',
    'div[id^="axs-tabs-"][id$="-panel-1"]',
    'div[class*="axs-tabs"]',
    'div[id*="axs-tabs"]',
    'section[class*="fundamentals"]',
    'div[class*="fundamentals"]',
    'div[id*="fundamentals"]',
    'div[data-rpa-tag-id*="fundamental"]',
    'div[data-rpa-tag-id*="fixed"]'
  ];

  // Helper: wait until no .crdownload files remain
  async function waitForDownloadComplete(dir) {
    // make sure download starts
    await sleep(800);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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
    mkdirSync(downloadPath, { recursive: true });
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
        return (el.textContent || "").trim();
      }
      return null;
    }, selector, click);
    if (debug) console.error(`selectElement result for '${selector}': '${found}'`);
    return found;
  }

  async function selectFirst(selectors, click = false) {
    for (const selector of selectors) {
      if (debug) console.error(`Trying selector: ${selector}`);
      const value = await selectElement(selector, click);
      if (value) {
        if (debug) console.error(`Selector matched: ${selector} => '${value}'`);
        return value;
      }
    }
    if (debug) console.error(`No selectors matched: ${selectors.join(', ')}`);
    return null;
  }

  async function waitForAnySelector(selectors, timeout = 60000) {
    if (debug) console.error(`Waiting for any selector: ${selectors.join(', ')}`);
    try {
      return await Promise.any(selectors.map(selector =>
        page.waitForSelector(selector, { timeout }).then(() => selector)
      ));
    } catch (err) {
      if (debug) console.error('waitForAnySelector failed', err);
      return null;
    }
  }

  async function findTextByPatterns(patterns) {
    return await page.evaluate((patterns) => {
      const normalize = text => (text || "").replace(/\s+/g, " ").trim().toLowerCase();
      const nodes = Array.from(document.querySelectorAll('body *'));
      for (const node of nodes) {
        const text = normalize(node.textContent);
        if (!text) continue;
        if (patterns.some(pattern => text.includes(pattern.toLowerCase()))) {
          return (node.textContent || "").replace(/\s+/g, " ").trim();
        }
      }
      return null;
    }, patterns);
  }

  function normalizeFundamentalsText(text) {
    return (text || "")
      .replace(/\s+/g, " ")
      .replace(/\b(Yield to maturity|Yield to worst|Average duration|Average effective maturity|Average coupon)\b/gi, "\n$1")
      .trim();
  }

  //if (debug) console.error("Opening Vanguard page...");
  await page.goto(
    url,
    { waitUntil: "domcontentloaded", timeout: 60000 }
  );
  await sleep(2000);
  await waitForAnySelector([
    '.distributions',
    'span[data-rpa-tag-id="hero-ff-secYield-pct"]',
    'span[data-rpa-tag-id*="secYield"]',
    'span[data-rpa-tag-id*="yield"]',
    'span[data-rpa-tag-id*="asOfDate"]',
    'div[data-rpa-tag-id*="secYield"]',
    'div[data-rpa-tag-id*="yield"]'
  ], 60000);

  // download distributions data
  if (!await selectElement('.distributions', false)) break;
  await sleep(2000);
  if (!await selectElement('#price-distribution-nav-item', false)) break;
  await sleep(2000);
  if (!await downloadFile("Export distribution data", downloadPath, `${ticker}-distributions.csv`)) break;

  //await downloadFile("Export full holdings", downloadPath, `${ticker}-holdings.csv`);

  //document.querySelector("#in-page-section-id-portfolio")
  // class = .
  // id = #

  // now get thirty day yield and as of date
  const rawSecYield = await selectFirst([
    'span[data-rpa-tag-id="hero-ff-secYield-pct"]',
    'span[data-rpa-tag-id*="secYield"]',
    'span[data-rpa-tag-id*="yield"]',
    'div[data-rpa-tag-id*="secYield"]',
    'div[data-rpa-tag-id*="yield"]'
  ], false);
  if (!rawSecYield) {
    console.error(`No thirtyDayYield found for ticker '${ticker}'`);
    break; // minimum requirement is to get the yield, if not found, skip the rest of processing for this ticker since it's likely the page structure has changed and other data points may also be missing or incorrect.
  }
  const secYield = (rawSecYield.replace("%", "").trim() / 100).toFixed(4) * 1;
  if (debug) console.error(`rawSecYield= '${rawSecYield}'=${secYield}`);
  const rawSecYieldAsOfDate = await selectFirst([
    'span[data-rpa-tag-id="hero-ff-secYield-asOfDate"]',
    'span[data-rpa-tag-id*="asOfDate"]',
    'div[data-rpa-tag-id*="asOfDate"]'
  ], false);
  if (!rawSecYieldAsOfDate) {
    console.error(`No asOfDate found for ticker '${ticker}'`);
    break;
  } else {
    const secYieldAsOfDate = new Date(rawSecYieldAsOfDate.replace(/as of /i, "")).toISOString().split("T")[0];
    if (debug) console.error(`rawSecYieldAsOfDate='${rawSecYieldAsOfDate}'='${secYieldAsOfDate}'`);
    rowData.thirtyDayYield = secYield.toFixed(4) * 1;
    rowData.asOfDate = secYieldAsOfDate;
  }

  // NAV
  let rawNAV = await selectElement('div[data-rpa-tag-id="pd-cp-nav-price"]', false);
  if (!rawNAV) {
    rawNAV = await selectElement('span[data-rpa-tag-id="pd-cp-nav-price"]', false);
  }
  if (!rawNAV) {
    console.error(`No rawNAV found for ticker '${ticker}'`);
  } else {
    const nav = rawNAV.replace('$', '').trim() * 1;
    if (debug) console.error(`rawNAV= '${rawNAV}'=${nav}`);
    if (nav) rowData.nav = nav.toFixed(2) * 1;
  }

  // fund name
  const rawFundName = await selectElement('[data-rpa-tag-id="dashboard-longName"]', false);
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
  let rawAum = await selectElement('div[data-rpa-tag-id="overview-ff-net-assets"]', false);
  if (!rawAum) {
    rawAum = await selectElement('span[data-rpa-tag-id="overview-ff-net-assets"]', false);
  }
  if (!rawAum) {
    rawAum = await selectElement('div[data-rpa-tag-id="overview-ff-total-net-assets"]', false);
  }
  if (!rawAum) {
    console.error(`No rawAum found for ticker '${ticker}'`);
  } else {
    const multiplier = rawAum.toLowerCase().includes("b") ? 1e9 : rawAum.toLowerCase().includes("m") ? 1e6 : 1;
    const aum = rawAum.replace(/[^0-9\.]/g, "").trim() * 1;
    if (debug) console.error(`rawAum= '${rawAum}'=${aum}`);
    if (aum) rowData.aum = (aum * multiplier).toFixed(0) * 1;
  }

  // #distributionYield
  let rawDistributionYield = await selectFirst([
    'div[id="distributionYield"]',
    'div[data-rpa-tag-id="overview-ff-distribution-yield"]',
    'div[data-rpa-tag-id="overview-ff-distributionYield"]',
    'div[data-rpa-tag-id*="distribution"]',
    'span[data-rpa-tag-id*="distribution"]'
  ], false);
  if (!rawDistributionYield) {
    rawDistributionYield = await findTextByPatterns([
      'distribution yield',
      'distribution by credit quality',
      'distribution by effective maturity',
      'distribution by issuer type'
    ]);
  }
  if (!rawDistributionYield) {
    console.error(`No rawDistributionYield found for ticker '${ticker}'`);
  } else {
    const distributionYield = (rawDistributionYield.replace(/DISTRIBUTION YIELD/i, "").replace(/as of.*$/i, "").replace("%", "").trim() / 100).toFixed(4) * 1;
    if (debug) console.error(`rawDistributionYield= '${rawDistributionYield}'=${distributionYield}`);
    if (distributionYield) rowData.distributionYield = distributionYield.toFixed(4) * 1;
  }

  // fundamental fixed income tab -> duration, yield to maturity, effective maturity, weighted average coupon.
  //#fundamentals-fixed-income-tab-pane-daily
  for (const tabText of fixedIncomeTabTexts) {
    if (debug) console.error(`Attempting fixed income tab click with text: '${tabText}'`);
    if (await clickElementByText(tabText, ['button', 'a', 'span', 'div'])) {
      if (debug) console.error(`Clicked fixed income tab text: '${tabText}'`);
      break;
    }
  }
  await sleep(1500);
  let rawFundamentals = await selectFirst(fixedIncomePanelSelectors, false);
  if (debug && rawFundamentals) console.error(`Found rawFundamentals with one of fixedIncomePanelSelectors.`);
  if (!rawFundamentals) {
    rawFundamentals = await findTextByPatterns([
      'duration',
      'yield to maturity',
      'yield to worst',
      'effective maturity',
      'average coupon',
      'coupon interest'
    ]);
  }
  if (!rawFundamentals) {
    console.error(`No rawFundamentals found for ticker '${ticker}'`);
  } else {
    rawFundamentals = normalizeFundamentalsText(rawFundamentals);
    const lines = rawFundamentals.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (debug) console.error(`rawFundamentals lines: ${lines.join(" | ")}`);

    const durationLineNum = lines.findIndex(l => l.toLowerCase().includes("average duration"));
    if (durationLineNum >= 0) {
      const durationLine = lines[durationLineNum].replace(/Average duration/i, "").replace("(years)", "").trim();
      const durationYears = durationLine.match(/([0-9]*\.?[0-9]+)/);
      if (durationYears) rowData.durationYears = parseFloat(durationYears[1]).toFixed(2) * 1;
    } else {
      console.error(`No duration line found in rawFundamentals for ticker '${ticker}'`);
    }

    const ytmLineNum = lines.findIndex(l => l.toLowerCase().includes("yield to maturity"));
    if (ytmLineNum >= 0) {
      const ytmLine = lines[ytmLineNum].replace(/Yield to maturity/i, "").trim();
      const yieldToMaturity = parseFloat(ytmLine.replace("%", "")) / 100;
      if (!Number.isNaN(yieldToMaturity)) rowData.yieldToMaturity = yieldToMaturity.toFixed(4) * 1;
    } else {
      console.error(`No yield to maturity line found in rawFundamentals for ticker '${ticker}'`);
    }

    const ytwLineNum = lines.findIndex(l => l.toLowerCase().includes("yield to worst"));
    if (ytwLineNum >= 0) {
      const ytwLine = lines[ytwLineNum].replace(/Yield to worst/i, "").trim();
      const yieldToWorst = parseFloat(ytwLine.replace("%", "")) / 100;
      if (!Number.isNaN(yieldToWorst)) rowData.yieldToWorst = yieldToWorst.toFixed(4) * 1;
    } else {
      console.error(`No yield to worst line found in rawFundamentals for ticker '${ticker}'`);
    }

    const maturityLineNum = lines.findIndex(l => l.toLowerCase().includes("average effective maturity"));
    if (maturityLineNum >= 0) {
      const maturityLine = lines[maturityLineNum].replace(/Average effective maturity/i, "").replace("(years)", "").trim();
      const maturityYears = maturityLine.match(/([0-9]*\.?[0-9]+)/);
      if (maturityYears) rowData.maturityYears = parseFloat(maturityYears[1]).toFixed(2) * 1;
    } else {
      console.error(`No effective maturity line found in rawFundamentals for ticker '${ticker}'`);
    }

    const wacLineNum = lines.findIndex(l => l.toLowerCase().includes("average coupon"));
    if (wacLineNum >= 0) {
      const wacLine = lines[wacLineNum].replace(/Average coupon/i, "").trim();
      const weightedAverageCoupon = parseFloat(wacLine.replace("%", "")) / 100;
      if (!Number.isNaN(weightedAverageCoupon)) rowData.weightedAverageCoupon = weightedAverageCoupon.toFixed(5) * 1;
    } else {
      console.error(`No average coupon line found in rawFundamentals for ticker '${ticker}'`);
    }
  }

  // we have all the facts we need, push to results array.
  results.push(rowData);

  if (!await selectElement('a#portfolio-nav-item', false)) break;
  await sleep(2000);
  if (!await clickButtonByText('Issuer type')) break;
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