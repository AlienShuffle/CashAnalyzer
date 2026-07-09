import puppeteer from "puppeteer";
import { readFileSync } from "fs";
import { extractFundFactsFromText } from "./lib/blackrockFactsParser.mjs";

//function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

const debug = false;

const browserPromise = puppeteer.launch({
    //headless: false,    // true for production, false for debugging to see the browser.
    defaultViewport: null
});
const browser = await browserPromise;

// this is the main function
// get a list of tickers with site URL (ticker,url) from stdin, scrape each one, and output facts as JSON to stdout
const rawFunds = readFileSync(0, 'utf8');
const funds = rawFunds.split('\n').filter(line => line.trim().length > 0);
if (debug) console.error(`Scraping: '${funds.join(", ")}'`);

let results = [];
for (const fund of funds) {

    // set fund information
    const fundInfo = fund.split(",");
    if (fundInfo.length < 2) {
        console.error(`Invalid fund info: '${fund}'`);
        continue;
    }
    const ticker = fundInfo[0];
    const url = fundInfo[1];
    const asOfDate = fundInfo[2] || null;
    const thirtyDayYield = fundInfo[3] || null;

    console.error(`Scraping fund: ${ticker}`);
    const page = await browser.newPage();

    let rowData = {
        "ticker": ticker,
        asOfDate: asOfDate,
        thirtyDayYield: thirtyDayYield,
        "source": "BlackRock",
        "timestamp": new Date()
    };

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function selectElement(selector, click = false) {
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
        if (debug) console.error(`Exiting selectElement() = ''''${found}''''`);
        return found;
    }

    async function selectDataPointByLabel(labelRegex) {
        if (debug) console.error(`Searching data point by label: ${labelRegex}`);
        return await page.evaluate((pattern, flags) => {
            const regex = new RegExp(pattern, flags);
            const normalize = text => (text || '').trim().replace(/\s+/g, ' ');
            const labelEls = Array.from(document.querySelectorAll('[data-id$="-label"]'));
            for (const el of labelEls) {
                const text = normalize(el.textContent);
                if (!regex.test(text)) continue;
                const item = el.closest('[role="listitem"]') || el.parentElement;
                if (item) {
                    const dataEl = item.querySelector('[data-id$="-data"], [webqc-datapoint$="-data"], [webqc-datapoint]');
                    if (dataEl && dataEl.textContent) {
                        return { label: text, value: normalize(dataEl.textContent) };
                    }
                    const siblings = Array.from(item.children).map(child => normalize(child.textContent));
                    const index = siblings.findIndex(value => regex.test(value));
                    if (index >= 0 && index + 1 < siblings.length) {
                        return { label: text, value: siblings[index + 1] };
                    }
                }
            }

            const selectors = ['dt', 'th', 'td', 'span', 'strong', 'b', 'label'];
            for (const selector of selectors) {
                const els = Array.from(document.querySelectorAll(selector));
                for (const el of els) {
                    const text = normalize(el.textContent);
                    if (!regex.test(text)) continue;
                    const sibling = el.nextElementSibling;
                    if (sibling && sibling.textContent) {
                        return { label: text, value: normalize(sibling.textContent) };
                    }
                    if (el.parentElement) {
                        const siblings = Array.from(el.parentElement.children).map(child => normalize(child.textContent));
                        const index = siblings.findIndex(value => regex.test(value));
                        if (index >= 0 && index + 1 < siblings.length) {
                            return { label: text, value: siblings[index + 1] };
                        }
                    }
                }
            }

            return null;
        }, labelRegex.source, labelRegex.flags);
    }

    async function selectDataPointValue(labelRegex, fallbackSelectors = []) {
        const point = await selectDataPointByLabel(labelRegex);
        if (point && point.value) return point.value;
        const alternate = await page.evaluate((pattern, flags) => {
            const regex = new RegExp(pattern, flags);
            const valuePattern = new RegExp('(?:' + pattern + ')[\\s\\S]{0,120}?([-+]?[0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?(?:\\s*(?:%|yrs|years|yr|b|m))?)', flags);
            const nodes = Array.from(document.querySelectorAll('body *'));
            for (const node of nodes) {
                const text = (node.textContent || '').trim().replace(/\s+/g, ' ');
                if (!regex.test(text)) continue;
                const sameMatch = valuePattern.exec(text);
                if (sameMatch && sameMatch[1]) {
                    return sameMatch[1].trim();
                }
                const next = node.nextElementSibling;
                if (next && next.textContent) {
                    const nextText = next.textContent.trim().replace(/\s+/g, ' ');
                    if (nextText) return nextText;
                }
                if (node.parentElement) {
                    const siblings = Array.from(node.parentElement.children).map(child => (child.textContent || '').trim().replace(/\s+/g, ' '));
                    const index = siblings.findIndex(value => regex.test(value));
                    if (index >= 0 && index + 1 < siblings.length) {
                        return siblings[index + 1];
                    }
                }
            }
            return null;
        }, labelRegex.source, labelRegex.flags);
        if (alternate) return alternate;
        for (const selector of fallbackSelectors) {
            const found = await selectElement(selector);
            if (found) return found;
        }
        return null;
    }

    async function selectPageText(regex) {
        if (debug) console.error(`Searching page text for: ${regex}`);
        return await page.evaluate((pattern, flags) => {
            const re = new RegExp(pattern, flags);
            const all = Array.from(document.querySelectorAll('body *'));
            for (const el of all) {
                const text = el.textContent || '';
                const match = re.exec(text);
                if (match) {
                    return match[0].trim();
                }
            }
            return null;
        }, regex.source, regex.flags);
    }

    async function selectDataByAttribute(attrPatterns) {
        if (debug) console.error(`Searching data attributes for patterns: ${attrPatterns}`);
        return await page.evaluate((patterns) => {
            const normalize = t => (t || '').trim().replace(/\s+/g, ' ');
            const attrs = Array.from(document.querySelectorAll('[data-id], [webqc-datapoint]'));
            for (const pat of patterns) {
                const re = new RegExp(pat, 'i');
                for (const el of attrs) {
                    const id = el.getAttribute('data-id') || el.getAttribute('webqc-datapoint') || '';
                    if (!id) continue;
                    if (re.test(id)) {
                        // prefer a child data node
                        const dataChild = el.querySelector('[data-id$="-data"], [webqc-datapoint$="-data"]');
                        if (dataChild && dataChild.textContent) return normalize(dataChild.textContent);
                        // search descendants for an explicit percent value
                        const pctDesc = el.querySelectorAll('*');
                        for (const d of pctDesc) {
                            if (d.textContent && /%/.test(d.textContent)) return normalize(d.textContent);
                        }
                        // search descendants for dollar amounts
                        for (const d of pctDesc) {
                            if (d.textContent && /\$/.test(d.textContent)) return normalize(d.textContent);
                        }
                        // finally return element text
                        if (el.textContent && el.textContent.trim()) return normalize(el.textContent);
                    }
                }
            }
            return null;
        }, attrPatterns);
    }

    async function selectPercentNearLabel(labelRegex) {
        if (debug) console.error(`Searching for percent near label: ${labelRegex}`);
        return await page.evaluate((pattern, flags) => {
            const regex = new RegExp(pattern, flags);
            const nodes = Array.from(document.querySelectorAll('body *'));
            for (const node of nodes) {
                const text = (node.textContent || '').trim().replace(/\s+/g, ' ');
                if (!regex.test(text)) continue;
                // search the node's parent and listitem for percent descendants
                const parents = [node, node.parentElement, node.closest('[role="listitem"]')];
                for (const p of parents) {
                    if (!p) continue;
                    const desc = Array.from(p.querySelectorAll('*'));
                    for (const d of desc) {
                        const dt = (d.textContent || '').trim();
                        const m = dt.match(/([-+]?[0-9]+(?:\.[0-9]+)?)\s*%/);
                        if (m && m[1]) return m[0];
                    }
                }
            }
            return null;
        }, labelRegex.source, labelRegex.flags);
    }

    function parseNumeric(text) {
        if (!text) return null;
        const match = text.match(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?/);
        return match ? Number(match[0].replace(/,/g, '')) : null;
    }

    function parsePercent(text) {
        if (!text) return null;
        // avoid parsing dates like 'May 28, 2026'
        if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(text)) return null;
        const hasPercent = /%/.test(text);
        const raw = text.replace(/%/g, '').trim();
        const value = parseNumeric(raw);
        if (value === null) return null;
        if (hasPercent) return value / 100;
        // if no percent sign, only accept small fractional numbers (<1)
        if (value < 1) return value;
        return null;
    }

    async function selectDateFromLabel(labelRegex) {
        const point = await selectDataPointByLabel(labelRegex);
        if (!point || !point.label) return null;
        const dateText = point.label.replace(labelRegex, '').trim().replace(/^as of\s*/i, '').replace(/^of\s*/i, '').trim();
        return dateText || null;
    }

    //if (debug) console.error("Opening BlackRock iShares ETF page...");
    const pageUrl = new URL(url);
    pageUrl.hostname = 'www.blackrock.com';
    if (!/\/overview(?:\/|\?|$)/i.test(pageUrl.pathname)) {
        pageUrl.pathname = `${pageUrl.pathname.replace(/\/$/, '')}/overview`;
    }
    pageUrl.search = 'cash=1';

    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.goto(
        pageUrl.toString(),
        { waitUntil: "networkidle2", timeout: 120000 }
    );

    await sleep(5000);

    const pageText = await page.evaluate(() => {
        const bodyText = document.body?.innerText || document.body?.textContent || '';
        return bodyText.replace(/\s+/g, ' ').trim();
    });
    const pageTitle = await page.title();
    const textFacts = extractFundFactsFromText(pageText, { ticker, pageTitle });

    // Fund Name
    let rawFundName = await selectElement('#fundHeader > header.main-header > div.col-4.column.grid > div.column.main-header-holder.col-three-quarter-width > h1 > span');
    if (!rawFundName) {
        rawFundName = await selectElement('h1');
    }
    if (!rawFundName && textFacts.fundName) {
        rawFundName = textFacts.fundName;
    }
    if (!rawFundName) {
        console.error(`No rawFundName found for ticker '${ticker}'`);
    } else {
        const fundName = rawFundName.trim();
        if (debug) console.error(`rawFundName= '${rawFundName}'=${fundName}`);
        if (fundName) rowData.fundName = fundName;
    }

    // Nav
    let rawNav = await selectElement('#fundheaderTabs > div > div:nth-child(1) > div > ul > li.navAmount > span.header-nav-data');
    // If the selector returned a date like 'May 29, 2026' the parseNumeric will pick up 29 — avoid that by checking for month names and falling back
    if (rawNav && /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(rawNav)) {
        rawNav = null;
    }
    if (!rawNav) {
        // try attribute-based walrus card or other selectors
        rawNav = await selectDataByAttribute(['navAmount','nav','nav-amount','nav-data','netAssetValue']);
    }
    if (!rawNav) {
        rawNav = await selectDataPointValue(/NAV\s+as\s+of/i, [
            '#fundheaderTabs > div > div:nth-child(1) > div > ul > li.navAmount > span.header-nav-data'
        ]);
    }
    if (textFacts.nav !== undefined) {
        rawNav = String(textFacts.nav);
    }
    if (!rawNav) {
        rawNav = null;
    }
    if (!rawNav) {
        console.error(`No rawNav found for ticker '${ticker}'`);
    } else {
        let nav = null;
        // prefer dollar-style extraction
        const dollarMatch = rawNav.match(/\$+\s*([-+]?[0-9,]+(?:\.[0-9]+)?)/);
        if (dollarMatch && dollarMatch[1]) {
            nav = Number(dollarMatch[1].replace(/,/g, ''));
        } else {
            // take the last numeric token to avoid day-of-month being picked up
            const nums = rawNav.match(/[-+]?[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?/g);
            if (nums && nums.length) nav = Number(nums[nums.length - 1].replace(/,/g, ''));
        }
        if (debug) console.error(`rawNav= '${rawNav}'=${nav}`);
        if (nav !== null && !isNaN(nav)) rowData.nav = nav.toFixed(2) * 1;
    }


    // Expense Ratio
    const rawExpenseRatio = await selectDataPointValue(/Expense\s*Ratio/i, [
        '#feeTable > div > div > table > tbody > tr.fee-code-expr > td.data'
    ]);
    const expenseRatioValue = textFacts.expenseRatio !== undefined ? String(textFacts.expenseRatio) : rawExpenseRatio;
    if (!expenseRatioValue) {
        console.error(`No rawExpenseRatio found for ticker '${ticker}'`);
    } else {
        const expenseRatio = parsePercent(expenseRatioValue);
        if (debug) console.error(`rawExpenseRatio= '${expenseRatioValue}'=${expenseRatio}`);
        if (expenseRatio !== null) rowData.expenseRatio = expenseRatio.toFixed(6) * 1;
    }

    // Assets Under Management (AUM)
    let rawAum = await selectDataPointValue(/(total\s+net\s+assets|net\s+assets|fund\s*\$)/i, [
        '#keyFundFacts > div > div.float-left.in-left > div.product-data-item.col-totalNetAssetsFundLevel > div.data'
    ]);
    if (!rawAum) {
        rawAum = await selectPageText(/fund\s*\$[0-9,\.]+/i);
    }
    if (!rawAum && textFacts.aum !== undefined) {
        rawAum = String(textFacts.aum);
    }
    if (!rawAum) {
        console.error(`No rawAum found for ticker '${ticker}'`);
    } else {
        const multiplier = rawAum.toLowerCase().includes('b') ? 1e9 : rawAum.toLowerCase().includes('m') ? 1e6 : 1;
        const aum = parseNumeric(rawAum);
        if (debug) console.error(`rawAum= '${rawAum}'=${aum}`);
        if (aum !== null) rowData.aum = (aum * multiplier).toFixed(0) * 1;
    }

    // Weighted Average Coupon
    const rawWeightedAverageCoupon = await selectDataPointValue(/(weighted\s+average\s+coupon|weighted\s+avg\s+coupon|avg\s+coupon)/i, [
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-weightedAvgCouponFi > div.data',
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-weightedAvgCouponFi > div.data'
    ]);
    const weightedAverageCouponValue = textFacts.weightedAverageCoupon !== undefined ? String(textFacts.weightedAverageCoupon) : rawWeightedAverageCoupon;
    if (!weightedAverageCouponValue) {
        console.error(`No rawWeightedAverageCoupon found for ticker '${ticker}'`);
    } else {
        const weightedAverageCoupon = parseNumeric(weightedAverageCouponValue);
        if (debug) console.error(`rawWeightedAverageCoupon= '${weightedAverageCouponValue}'=${weightedAverageCoupon}`);
        if (weightedAverageCoupon !== null) rowData.weightedAverageCoupon = weightedAverageCoupon.toFixed(4) * 1;
    }

    // Duration Years
    let rawDurationYears = await selectDataPointValue(/(duration|model\s*OAD)/i, [
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-modelOad > div.data',
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-modelOad > div.data'
    ]);
    const durationValue = textFacts.durationYears !== undefined ? String(textFacts.durationYears) : rawDurationYears;
    if (!durationValue) {
        console.error(`No rawDurationYears found for ticker '${ticker}'`);
    } else {
        const durationYears = parseNumeric(durationValue.replace(/years|yrs/i, '').trim());
        if (debug) console.error(`rawDurationYears= '${durationValue}'=${durationYears}`);
        if (durationYears !== null) rowData.durationYears = durationYears.toFixed(2) * 1;
    }

    // Yield to Maturity (actually yield to worst)
    const rawYieldToWorst = await selectDataPointValue(/(yield\s+to\s+worst|weighted\s+avg\s+yield\s+to\s+maturity|yield\s+to\s+maturity)/i, [
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-yieldToWorst > div.data',
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-weightedAvgYieldToMaturity > div.data'
    ]);
    const yieldToWorstValue = textFacts.yieldToWorst !== undefined ? String(textFacts.yieldToWorst) : rawYieldToWorst;
    if (!yieldToWorstValue) {
        console.error(`No rawYieldToWorst found for ticker '${ticker}'`);
    } else {
        const yieldToWorst = parsePercent(yieldToWorstValue);
        if (debug) console.error(`rawYieldToWorst= '${yieldToWorstValue}'=${yieldToWorst}`);
        if (yieldToWorst !== null) rowData.yieldToWorst = yieldToWorst.toFixed(4) * 1;
    }

    // distribution yield not provided on BlackRock site, so skipping.

    // 12m trailing yield.
    const rawTrailing12mYield = await selectDataPointValue(/12m\s*Trailing\s*Yield/i, [
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-twelveMonTrlYld > div.data'
    ]);
    const trailing12mYieldValue = textFacts.twelveMonTrlYield !== undefined ? String(textFacts.twelveMonTrlYield) : rawTrailing12mYield;
    if (!trailing12mYieldValue) {
        console.error(`No rawTrailing12mYield found for ticker '${ticker}'`);
    } else {
        const trailing12mYield = parsePercent(trailing12mYieldValue);
        if (debug) console.error(`rawTrailing12mYield= '${trailing12mYieldValue}'=${trailing12mYield}`);
        if (trailing12mYield !== null) rowData.twelveMonTrlYield = trailing12mYield.toFixed(4) * 1;
    }

    // Weighted Average Maturity (maturityYears)
    let rawMaturityYears = await selectDataPointValue(/(weighted\s+average\s+life|weighted\s+average\s+maturity|average\s+life|avg\s+life|term\s+to\s+maturity)/i, [
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-right > div.product-data-item.col-weightedAvgLife > div.data',
        '#fundamentalsAndRisk > div.product-data-list.data-points-en_US > div.float-left.in-left > div.product-data-item.col-weightedAvgLife > div.data'
    ]);
    if (textFacts.maturityYears !== undefined) {
        rawMaturityYears = String(textFacts.maturityYears);
    }
    if (!rawMaturityYears) {
        // Fallback: search walrus-rendered cards by attribute names
        rawMaturityYears = await selectDataByAttribute(['weightedAvgLife', 'weightedAvgMaturity', 'termToMaturity', 'avgLife', 'weightedAvgLife-data', 'weightedAvgLife']);
    }
    if (!rawMaturityYears) {
        console.error(`No rawMaturityYears found for ticker '${ticker}'`);
    } else {
        const maturityYears = parseNumeric(rawMaturityYears.replace(/years|yrs/i, '').trim());
        if (debug) console.error(`rawMaturityYears= '${rawMaturityYears}'=${maturityYears}`);
        if (maturityYears !== null) rowData.maturityYears = maturityYears.toFixed(2) * 1;
    }

    // we have all the facts we need, push to results array.
    results.push(rowData);

    if (debug) console.error("Completed processing for ticker:", ticker);
    await sleep(2000);
    await page.close();
    // do only a few due to rate limiting concerns...
    if (results.length > 10) break;
}
if (debug) console.error("Script complete.");
console.log(JSON.stringify(results));
browser.close();