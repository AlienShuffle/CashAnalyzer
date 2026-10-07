import puppeteer from "puppeteer";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  mkdirSync,
  existsSync
} from "fs";
import {
  join
} from "node:path";

//function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

const debug = false;

const browserPromise = puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
  headless: true,    // true for production, false for debugging to see the browser.
  defaultViewport: null,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
const browser = await browserPromise;

// Download completion is tracked through browser-level CDP events rather than by watching the
// download directory. Chrome emits these on the browser target, not on a page session.
const downloadSession = await browser.target().createCDPSession();
const downloadTimeoutMs = 60000;

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

  // The page fetches its own distribution history on load. Capturing that response gives a
  // structured source that does not depend on the CSV export button working.
  let distributionsData = null;
  page.on("response", async response => {
    if (!/\/api\/funds\/[^/]+\/pricing\/distributions(\?|$)/.test(response.url())) return;
    try {
      const body = await response.json();
      if (Array.isArray(body) && body.length > 0) distributionsData = body;
    } catch {
      // Ignore responses that are redirected, aborted, or not JSON.
    }
  });

  function saveDistributionsData() {
    if (!distributionsData) return false;
    mkdirSync(downloadPath, { recursive: true });
    writeFileSync(
      join(downloadPath, `${ticker}-distributions.json`),
      JSON.stringify(distributionsData, null, 1)
    );
    return true;
  }

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

  // Helper: resolve with the GUID of the download Chrome just completed, or null on
  // failure. Listeners are registered before the click so a fast download cannot be missed.
  function waitForDownload() {
    return new Promise(resolve => {
      let guid = null;
      const onBegin = event => { guid = event.guid; };
      const onProgress = event => {
        if (guid && event.guid !== guid) return;
        if (event.state === "completed") finish(event.guid || guid);
        else if (event.state === "canceled") finish(null);
      };
      const finish = value => {
        clearTimeout(timer);
        downloadSession.off("Browser.downloadWillBegin", onBegin);
        downloadSession.off("Browser.downloadProgress", onProgress);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), downloadTimeoutMs);
      downloadSession.on("Browser.downloadWillBegin", onBegin);
      downloadSession.on("Browser.downloadProgress", onProgress);
    });
  }

  // Downloads land under their GUID ("allowAndName"), so the file belonging to this click is
  // identified exactly. Any failure leaves the existing target file untouched and returns
  // false, so a broken export can never be mistaken for fresh data.
  async function downloadFile(buttonText, downloadPath, csvFileName, expectedContent) {
    const exportButton = await exportButtonFinder(buttonText);
    if (!exportButton) {
      console.error(`Button with text '${buttonText}' not found.`);
      return false;
    }
    mkdirSync(downloadPath, { recursive: true });
    await downloadSession.send("Browser.setDownloadBehavior", {
      behavior: "allowAndName",
      downloadPath: downloadPath,
      eventsEnabled: true
    });

    const downloadComplete = waitForDownload();
    await exportButton.focus();
    await exportButton.click();

    if (debug) console.error("Waiting for CSV download...");
    const guid = await downloadComplete;
    if (!guid) {
      console.error(`Download '${buttonText}' never completed; keeping '${csvFileName}' unchanged.`);
      return false;
    }

    const downloadedPath = join(downloadPath, guid);
    if (!existsSync(downloadedPath)) {
      console.error(`Download '${buttonText}' reported complete but '${guid}' is missing.`);
      return false;
    }
    if (expectedContent && !readFileSync(downloadedPath, "utf8").includes(expectedContent)) {
      console.error(`Download '${buttonText}' lacks '${expectedContent}'; discarding wrong file.`);
      rmSync(downloadedPath, { force: true });
      return false;
    }

    const newPath = join(downloadPath, csvFileName);
    renameSync(downloadedPath, newPath);
    if (debug) console.error("Renamed file:", newPath);
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
  const distributionsJsonSaved = saveDistributionsData();
  const distributionsCsvSaved = await downloadFile(
    "Export distribution data", downloadPath, `${ticker}-distributions.csv`, "$/SHARE");
  if (!distributionsCsvSaved && !distributionsJsonSaved) {
    console.error(`No distribution data captured for ticker '${ticker}'.`);
    break;
  }

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
  if (!await downloadFile("Export issuer type data", downloadPath, `${ticker}-issuer-type.csv`, "Weighted exposures")) break;
  if (debug) console.error("Completed processing for ticker:", ticker);
  await sleep(2000);
  await page.close();
  // do only a few due to rate limiting concerns...
  if (results.length > 5) break;
}

if (debug) console.error("Script complete.");
console.log(JSON.stringify(results));
browser.close();