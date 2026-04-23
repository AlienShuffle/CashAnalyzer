/**
 * Schuylkill County (CountySuite) Civil Portal scraper (Puppeteer)
 * - Searches last 20 years for Lake Wynonah Property Owners Association-related cases
 * - Traverses pagination
 * - Opens each case and tries to extract judgment amount(s)
 *
 * Notes:
 * - CountySuite portals are heavily JS-driven; selectors may need tweaking.
 * - Script includes robust "find input by label text" helpers and network-idle waits.
 */

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const BASE_URL = "https://portal.schuylkill.pa.countysuite-azuregov.us/courts.civil.portal/"; // stable base (avoid sessioned S(...) urls)
const OUT_JSON = "cases.json";
const OUT_CSV = "cases.csv";

const NAME_VARIANTS = [
  "Lake Wynonah Property Owners Association",
  "Lake Wynonah Property Owners Association, Inc.",
  "Lake Wynonah POA",
  "LWPOA"
];

const YEARS_BACK = 20;

// Environment toggles
//const HEADLESS = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";
const HEADLESS = "false";
const SLOW_MO = Number(process.env.SLOW_MO ?? 10);         // e.g. 50 for debugging
const MAX_CASES = Number(process.env.MAX_CASES ?? 100);     // 0 = no limit

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toISODateOnly(d) {
  // yyyy-mm-dd
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function moneyFromText(txt) {
  // Returns array of money-like strings, e.g. ["$1,234.56", "$500"]
  if (!txt) return [];
  const matches = txt.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g);
  return matches ? matches.map(m => m.replace(/\s+/g, "")) : [];
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function toCSV(rows) {
  const cols = [
    "caseNumber",
    "caption",
    "status",
    "openedDate",
    "caseCategory",
    "detailUrl",
    "judgmentAmounts",
    "judgmentTotal"
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(cols.map(c => esc(r[c])).join(","));
  }
  return lines.join("\n");
}

/**
 * Find an input/select element associated with a label containing labelText (case-insensitive).
 * Works for many “label + input” layouts, including div-based forms.
 */
async function findControlByLabel(page, labelText) {
  const lc = labelText.toLowerCase();
  return await page.evaluateHandle((lc) => {
    const labels = Array.from(document.querySelectorAll("label, span, div"))
      .filter(el => el && el.textContent && el.textContent.toLowerCase().includes(lc));

    // Try typical patterns: <label for="id"> then #id
    for (const lab of labels) {
      const forId = lab.getAttribute && lab.getAttribute("for");
      if (forId) {
        const ctl = document.getElementById(forId);
        if (ctl) return ctl;
      }
    }

    // Try: label wrapping input
    for (const lab of labels) {
      const input = lab.querySelector && lab.querySelector("input, select, textarea");
      if (input) return input;
    }

    // Try: sibling / nearby input
    for (const lab of labels) {
      const root = lab.closest("div, li, td, th, section, form") || lab.parentElement;
      if (!root) continue;
      const near = root.querySelector && root.querySelector("input, select, textarea");
      if (near) return near;
    }

    return null;
  }, lc);
}

async function safeType(page, handle, value) {
  if (!handle) return false;
  const el = handle.asElement();
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await page.keyboard.type(value, { delay: 10 });
  return true;
}

async function clickByText(page, text) {
  // Click first element matching exact-ish visible text
  const lc = text.toLowerCase();
  const handle = await page.evaluateHandle((lc) => {
    const candidates = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']"));
    const el = candidates.find(e => (e.textContent || e.value || "").trim().toLowerCase().includes(lc));
    return el || null;
  }, lc);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
}

async function extractResultsFromTable(page) {
  // Attempts to read a visible results table; returns row objects with at least caseNumber + detailUrl if available.
  return await page.evaluate(() => {
    // find a likely results table
    const tables = Array.from(document.querySelectorAll("table"));
    const table = tables.find(t => {
      const txt = (t.innerText || "").toLowerCase();
      return txt.includes("case") && (txt.includes("number") || txt.includes("status") || txt.includes("opened"));
    }) || tables[0];

    if (!table) return [];

    const headerCells = Array.from(table.querySelectorAll("thead th")).map(th => (th.innerText || "").trim());
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    const idx = (nameIncludes) => {
      const lc = nameIncludes.toLowerCase();
      return headerCells.findIndex(h => h.toLowerCase().includes(lc));
    };

    const iCase = idx("case");
    const iStatus = idx("status");
    const iOpened = idx("opened") >= 0 ? idx("opened") : idx("filed");
    const iCat = idx("category") >= 0 ? idx("category") : idx("type");
    const iCaption = idx("caption") >= 0 ? idx("caption") : idx("title");

    const out = [];

    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (!tds.length) continue;

      // Look for detail link in row (often case number is an <a>)
      const link = tr.querySelector("a[href]");
      const href = link ? link.href : "";

      const get = (i) => (i >= 0 && i < tds.length) ? (tds[i].innerText || "").trim() : "";

      // Case number may be in a column or in link text
      const caseNumber = get(iCase) || (link ? (link.innerText || "").trim() : "");
      const status = get(iStatus);
      const openedDate = get(iOpened);
      const caseCategory = get(iCat);
      const caption = get(iCaption);

      out.push({ caseNumber, status, openedDate, caseCategory, caption, detailUrl: href });
    }

    // Filter junk rows
    return out.filter(r => r.caseNumber || r.detailUrl);
  });
}

async function goNextPage(page) {
  // Tries common "Next" controls; returns true if it clicked something.
  // CountySuite portals often use pagination buttons/links.
  const clicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, a"))
      .filter(el => {
        const t = (el.textContent || "").trim().toLowerCase();
        return t === "next" || t.includes("next >") || t.includes("›") || t.includes(">");
      });

    const enabled = candidates.find(el => {
      const disabled = el.getAttribute("disabled") !== null || el.classList.contains("disabled") || el.getAttribute("aria-disabled") === "true";
      return !disabled;
    });

    if (enabled) { enabled.click(); return true; }
    return false;
  });

  if (clicked) {
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => { });
    await sleep(500);
    return true;
  }
  return false;
}

async function extractCaseDetails(page) {
  // Best-effort extraction from a case detail page/dialog
  return await page.evaluate(() => {
    const text = (sel) => (document.querySelector(sel)?.innerText || "").trim();

    // Try multiple label-value patterns
    const byLabel = (labelIncludes) => {
      const lc = labelIncludes.toLowerCase();
      const nodes = Array.from(document.querySelectorAll("div, dt, th, label, span"))
        .filter(n => (n.textContent || "").trim().toLowerCase().includes(lc));
      for (const n of nodes) {
        // definition list: <dt>Label</dt><dd>Value</dd>
        if (n.tagName === "DT" && n.nextElementSibling?.tagName === "DD") {
          const v = (n.nextElementSibling.textContent || "").trim();
          if (v) return v;
        }
        // table header: <th>Label</th><td>Value</td>
        if (n.tagName === "TH") {
          const td = n.parentElement?.querySelector("td");
          const v = (td?.textContent || "").trim();
          if (v) return v;
        }
        // generic: label container then next sibling
        const sib = n.nextElementSibling;
        const v = (sib?.textContent || "").trim();
        if (v && v.length < 500) return v;
      }
      return "";
    };

    const caption = byLabel("caption") || byLabel("case caption") || text("h1") || text("h2");
    const caseNumber = byLabel("case number") || byLabel("docket") || "";
    const status = byLabel("status") || "";
    const openedDate = byLabel("opened") || byLabel("filed") || byLabel("date opened") || "";
    const caseCategory = byLabel("category") || byLabel("case type") || "";

    // Capture likely judgments section text if present
    const judgmentSection =
      Array.from(document.querySelectorAll("section, div, table"))
        .find(el => (el.innerText || "").toLowerCase().includes("judgment"))?.innerText || "";

    const bodyText = document.body?.innerText || "";
    return {
      caseNumber,
      caption,
      status,
      openedDate,
      caseCategory,
      judgmentSectionText: judgmentSection,
      pageTextSample: bodyText.slice(0, 5000)
    };
  });
}

async function openDetailAndScrape(browser, listPage, row) {
  // If we have a direct URL, open it. Otherwise, try clicking the case number link.
  const detailUrl = row.detailUrl;

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");

  // Be conservative with timeouts; the portal is JS-heavy
  page.setDefaultTimeout(60000);

  if (detailUrl) {
    await page.goto(detailUrl, { waitUntil: "networkidle2" }).catch(async () => {
      await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => { });
    });
  } else {
    // Fallback: try to click matching case on listPage and copy URL (less reliable)
    await page.close();
    return {
      ...row,
      judgmentAmounts: [],
      judgmentTotal: "",
      scrapeNote: "No detailUrl found on result row; adjust extractResultsFromTable selectors."
    };
  }

  // Try to extract details
  const details = await extractCaseDetails(page);

  // Parse money from judgment section; fallback to whole page sample
  const moneyA = moneyFromText(details.judgmentSectionText);
  const moneyB = moneyFromText(details.pageTextSample);
  const judgmentAmounts = Array.from(new Set([...moneyA, ...moneyB]));

  // Compute a rough total if amounts parse cleanly
  let judgmentTotal = "";
  try {
    const vals = judgmentAmounts
      .map(m => Number(m.replace("$", "").replace(/,/g, "")))
      .filter(n => Number.isFinite(n));
    if (vals.length) judgmentTotal = vals.reduce((a, b) => a + b, 0).toFixed(2);
  } catch { /* ignore */ }

  const final = {
    caseNumber: details.caseNumber || row.caseNumber || "",
    caption: details.caption || row.caption || "",
    status: details.status || row.status || "",
    openedDate: details.openedDate || row.openedDate || "",
    caseCategory: details.caseCategory || row.caseCategory || "",
    detailUrl: page.url(),
    judgmentAmounts: judgmentAmounts.join(" | "),
    judgmentTotal
  };

  await page.close();
  // small politeness delay
  await sleep(600);
  return final;
}

async function runQueryVariant(browser, variant, startDate, endDate) {
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");
  page.setDefaultTimeout(60000);

  // Helpful for reverse engineering endpoints
  const apiHits = [];
  page.on("response", async (resp) => {
    const url = resp.url();
    if (/api|publicsearch|search|Case/i.test(url)) {
      apiHits.push(url);
    }
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle2" }).catch(async () => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => { });
  });

  // Wait for UI to be interactive
  await new Promise(resolve => setTimeout(resolve, 1200));

  // Many CountySuite pages include “Search by Participant Name”
  // Try clicking that mode first (best-effort)
  await clickByText(page, "Search by Participant Name").catch(() => { });
  await new Promise(resolve => setTimeout(resolve, 800));

  // Fill participant / name field
  const nameCtlH = await findControlByLabel(page, "Participant Name");
  const nameCtlH2 = await findControlByLabel(page, "Name");
  const typed = await safeType(page, nameCtlH, variant) || await safeType(page, nameCtlH2, variant);

  if (!typed) {
    console.warn(`[WARN] Could not find a name input for variant "${variant}". You may need to tweak label text.`);
  }

  // Fill date range fields “Start” and “End” (Only Cases Opened within this Date Range)
  // The portal UI shows Start/End date controls. [1](https://portal.schuylkill.pa.countysuite-azuregov.us/courts.civil.portal/)[2](https://app.schuylkill.pa.countysuite-azuregov.us/courts.civil.publicsearch/%28S%2843z32gsxpprzjmx2oclrrme0%29%29/Default.aspx)
  const startCtlH = await findControlByLabel(page, "Start");
  const endCtlH = await findControlByLabel(page, "End");

  if (startCtlH) await safeType(page, startCtlH, startDate);
  if (endCtlH) await safeType(page, endCtlH, endDate);

  // Click Search
  const searched = await clickByText(page, "Search") || await clickByText(page, "Find");
  if (!searched) {
    console.warn("[WARN] Could not find a Search button by text. Trying Enter key.");
    await page.keyboard.press("Enter");
  }

  await page.waitForNetworkIdle({ idleTime: 800, timeout: 60000 }).catch(() => { });
  await new Promise(resolve => setTimeout(resolve, 800));

  // Paginate & collect all rows
  const allRows = [];
  let pageCount = 0;

  while (true) {
    pageCount++;

    const rows = await extractResultsFromTable(page);
    if (rows.length) allRows.push(...rows);

    // Stop if MAX_CASES is configured
    if (MAX_CASES > 0 && allRows.length >= MAX_CASES) break;

    const moved = await goNextPage(page);
    if (!moved) break;

    // Safety: avoid endless loops if pagination misbehaves
    if (pageCount > 500) break;
  }

  // Close list page
  await page.close();

  return { rows: allRows, apiHits };
}

(async () => {
  const now = new Date();
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - YEARS_BACK);

  // Many portals accept mm/dd/yyyy; we’ll provide both ISO and US-style fallback in code comments.
  // You may need to change formatting depending on the site’s date inputs.
  const startISO = toISODateOnly(start); // yyyy-mm-dd
  const endISO = toISODateOnly(now);   // yyyy-mm-dd

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    slowMo: SLOW_MO,
    defaultViewport: { width: 1280, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  });

  const combinedRows = [];
  const apiSeen = new Set();

  try {
    for (const variant of NAME_VARIANTS) {
      console.log(`\n=== Searching variant: ${variant} | Date range: ${startISO} to ${endISO} ===`);
      const { rows, apiHits } = await runQueryVariant(browser, variant, startISO, endISO);

      rows.forEach(r => combinedRows.push(r));
      apiHits.forEach(u => apiSeen.add(u));

      // Polite pause between variants
      await sleep(1200);
    }

    // Deduplicate by case number if possible (else by detailUrl)
    let deduped = uniqBy(combinedRows, r => (r.caseNumber || "").trim() || (r.detailUrl || "").trim());

    console.log(`\nFound ${combinedRows.length} raw rows, ${deduped.length} deduped rows.`);

    // Now open each case and attempt to scrape judgment amounts
    const final = [];
    let i = 0;

    for (const row of deduped) {
      i++;
      if (MAX_CASES > 0 && i > MAX_CASES) break;

      console.log(`Scraping case ${i}/${deduped.length}: ${row.caseNumber || row.detailUrl || "(no id)"}`);
      const details = await openDetailAndScrape(browser, null, row);
      final.push(details);

      // Polite rate limiting
      await sleep(900);
    }

    // Write output
    fs.writeFileSync(OUT_JSON, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      dateRange: { start: startISO, end: endISO },
      nameVariants: NAME_VARIANTS,
      possibleApiEndpointsObserved: Array.from(apiSeen),
      cases: final
    }, null, 2));

    fs.writeFileSync(OUT_CSV, toCSV(final));

    console.log(`\nDone.\n- ${OUT_JSON}\n- ${OUT_CSV}`);
    if (apiSeen.size) {
      console.log("\nObserved possible API endpoints (helpful for building a faster non-UI scraper):");
      Array.from(apiSeen).slice(0, 50).forEach(u => console.log("  " + u));
      if (apiSeen.size > 50) console.log(`  ...and ${apiSeen.size - 50} more`);
    }
  } finally {
    await browser.close();
  }
})();
