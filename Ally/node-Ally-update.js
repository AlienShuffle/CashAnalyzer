/**
 * Scrape Ally Bank rates (APY) for:
 * - No Penalty CD (11-month)
 * - Online Savings Account
 *
 * Sources:
 *  - https://www.ally.com/bank/no-penalty-cd/
 *  - https://www.ally.com/bank/view-rates/
 */

import puppeteer from "puppeteer"; // ESM import [1](https://www.npmjs.com/package/puppeteer)

const URLS = {
  noPenaltyCd: "https://www.ally.com/bank/no-penalty-cd/",
  viewRates: "https://www.ally.com/bank/view-rates/",
};

function firstPercentNear(text, anchorRegex, windowSize = 250, debug = false, debugLabel = "") {
  const m = anchorRegex.exec(text);
  if (!m) {
    if (debug) console.error(`[DEBUG] ${debugLabel}: no match for ${anchorRegex}`);
    return null;
  }

  const start = Math.max(0, m.index - windowSize);
  const end = Math.min(text.length, m.index + windowSize);
  const slice = text.slice(start, end);

  const matches = Array.from(slice.matchAll(/(\d+(?:\.\d+)?)\s*%/g));
  if (matches.length === 0) {
    if (debug) console.error(`[DEBUG] ${debugLabel}: anchor "${m[0]}" found but no %% in window`);
    return null;
  }

  const result = `${matches[0][1]}%`;
  if (debug) {
    console.error(`[DEBUG] ${debugLabel}: matched anchor "${m[0]}" → first %% = ${result}`);
    console.error(`[DEBUG]   window: "${slice.slice(0, 100).replace(/\n/g, ' ')}..."`);
  }
  return result;
}

async function getRenderedText(page) {
  return await page.evaluate(() => document.body?.innerText || "");
}

async function scrapeNoPenaltyCdApy(page, debug = false) {
  const MIN_APY_THRESHOLD = 1.0; // Filter out loyalty rewards < 1%

  const text = (await getRenderedText(page)).replace(/\u00A0/g, " ");
  let textApy =
    firstPercentNear(text, /No[\s-]?Penalty/i, 250, debug, "noPenalty anchor") ||
    firstPercentNear(text, /\bAPY\b/i, 250, debug, "APY anchor");

  // Validate against threshold to skip low loyalty values
  if (textApy) {
    const apyVal = parseFloat(textApy);
    if (apyVal >= MIN_APY_THRESHOLD) {
      if (debug) console.error(`[DEBUG] noPenalty APY ${textApy} passes threshold check (≥ ${MIN_APY_THRESHOLD}%)`);
      return { apy: textApy, method: "text-anchor" };
    } else {
      if (debug) console.error(`[DEBUG] noPenalty APY ${textApy} rejected: below threshold (< ${MIN_APY_THRESHOLD}%)`);
      textApy = null;
    }
  }

  // Fallback to DOM-based heuristics in case text scan fails.
  if (debug) console.error(`[DEBUG] Falling back to DOM-based scraping for noPenalty CD`);
  const domResult = await page.evaluate(() => {
    const percentRe = /(\d+(?:\.\d+)?)\s*%/;

    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter((el) => el && el.children.length === 0 && !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName))
      .map((el) => (el.textContent || "").trim())
      .filter((t) => t.length > 0);

    const anchorIdx = candidates.findIndex((t) => /No[\s-]?Penalty/i.test(t));

    if (anchorIdx !== -1) {
      let best = null;
      for (let i = anchorIdx; i < Math.min(candidates.length, anchorIdx + 50); i++) {
        const m = candidates[i].match(percentRe);
        if (m) best = `${m[1]}%`;
      }
      if (best) return { apy: best, method: "dom-near-no-penalty" };

      for (let i = Math.max(0, anchorIdx - 50); i < anchorIdx; i++) {
        const m = candidates[i].match(percentRe);
        if (m) return { apy: `${m[1]}%`, method: "dom-near-no-penalty-back" };
      }
    }

    const apyIdx = candidates.findIndex(
      (t) => /Annual Percentage Yield/i.test(t) || /\bAPY\b/i.test(t)
    );

    if (apyIdx !== -1) {
      for (let i = apyIdx; i < Math.min(candidates.length, apyIdx + 30); i++) {
        const m = candidates[i].match(percentRe);
        if (m) return { apy: `${m[1]}%`, method: "dom-near-apy" };
      }
    }

    return null;
  });

  if (domResult?.apy) return domResult;

  return { apy: null, method: "not-found" };
}

async function scrapeSavingsApyFromViewRates(page, debug = false) {
  const MIN_APY_THRESHOLD = 1.5; // Savings typically higher; reject checking rates (~0.1%) or loyalty bonuses

  const domResult = await page.evaluate(() => {
    const percentRe = /(\d+(?:\.\d+)?)\s*%/;

    const nodes = Array.from(document.querySelectorAll("body *"))
      .filter((el) => el && el.children.length === 0 && !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName))
      .map((el) => ({
        text: (el.innerText || el.textContent || "").trim(),
      }))
      .filter((x) => x.text && x.text.length > 0);

    const savingsIndices = nodes
      .map((n, i) => (/^Savings$/i.test(n.text) ? i : -1))
      .filter((i) => i >= 0);
    const idx = savingsIndices.length > 0
      ? savingsIndices[savingsIndices.length - 1]
      : nodes.findIndex((n) => /\bSavings\b/i.test(n.text));

    if (idx !== -1) {
      for (let i = idx; i < Math.min(nodes.length, idx + 60); i++) {
        const m = nodes[i].text.match(percentRe);
        if (m) return { apy: `${m[1]}%`, method: "dom-near-savings" };
      }
      for (let i = Math.max(0, idx - 60); i < idx; i++) {
        const m = nodes[i].text.match(percentRe);
        if (m) return { apy: `${m[1]}%`, method: "dom-near-savings-back" };
      }
    }

    const line = nodes.find((n) => /Savings/i.test(n.text) && percentRe.test(n.text));
    if (line) {
      const m = line.text.match(percentRe);
      return { apy: `${m[1]}%`, method: "dom-line-savings" };
    }

    return null;
  });

  if (domResult?.apy) {
    const apyVal = parseFloat(domResult.apy);
    if (apyVal >= MIN_APY_THRESHOLD) {
      if (debug) console.error(`[DEBUG] Savings APY ${domResult.apy} (DOM) passes threshold`);
      return domResult;
    } else {
      if (debug) console.error(`[DEBUG] Savings APY ${domResult.apy} (DOM) rejected: below threshold (< ${MIN_APY_THRESHOLD}%)`);
    }
  }

  const text = (await getRenderedText(page)).replace(/\u00A0/g, " ");
  if (debug) console.error(`[DEBUG] Trying text-based anchors for Savings APY`);

  let apy =
    firstPercentNear(text, /Great\s+for:\s*.*savings/i, 250, debug, "savings great-for") ||
    firstPercentNear(text, /\bSavings\b.*Annual Percentage Yield/i, 250, debug, "savings-APY combo") ||
    firstPercentNear(text, /\bSavings\b/i, 250, debug, "Savings keyword") ||
    firstPercentNear(text, /Savings Account/i, 250, debug, "Savings Account") ||
    null;

  if (apy) {
    const apyVal = parseFloat(apy);
    if (apyVal >= MIN_APY_THRESHOLD) {
      if (debug) console.error(`[DEBUG] Savings APY ${apy} (text) passes threshold`);
      return { apy, method: "text-fallback" };
    } else {
      if (debug) console.error(`[DEBUG] Savings APY ${apy} (text) rejected: below threshold (< ${MIN_APY_THRESHOLD}%)`);
      apy = null;
    }
  }

  return { apy: null, method: "not-found" };
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((resolve) => setTimeout(resolve, 800));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  );
  await page.setViewport({ width: 1280, height: 900 });

  try {
    const DEBUG = process.env.DEBUG === "true";
    if (DEBUG) {
      console.error('[DEBUG] Starting APY scraper...');
      console.error('Puppeteer version:', puppeteer.version);
    }

    if (DEBUG) console.error(`[DEBUG] Navigating to ${URLS.noPenaltyCd}`);
    await goto(page, URLS.noPenaltyCd);
    const noPenalty = await scrapeNoPenaltyCdApy(page, DEBUG);

    if (DEBUG) console.error(`[DEBUG] Navigating to ${URLS.viewRates}`);
    await goto(page, URLS.viewRates);
    const savings = await scrapeSavingsApyFromViewRates(page, DEBUG);

    const results = [];
    const asOfDate = new Date().toISOString().split("T")[0];
    const now = new Date();
    if (savings)
      results.push({
        accountType: 'Savings',
        apy: (savings.apy) ? (savings.apy.replace('%', '') / 100).toFixed(4) * 1 : 'n/a',
        asOfDate: asOfDate,
        source: 'node-Ally-update.js ' + savings.method,
        timestamp: now,
      });
    if (noPenalty)
      results.push({
        accountType: 'NPCD',
        apy: (noPenalty.apy) ? (noPenalty.apy.replace('%', '') / 100).toFixed(4) * 1 : 'n/a',
        asOfDate: asOfDate,
        source: 'node-Ally-update.js ' + noPenalty.method,
        timestamp: now,
      });

    console.log(JSON.stringify(results, null, 2));

    if (!results[0]?.apy || !results[1]?.apy) {
      process.exitCode = 2;
    }
  } catch (err) {
    console.error("Error scraping rates:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();