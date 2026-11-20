/**
 * Browser automation for the Schuylkill County CountySuite civil portal.
 *
 * Page layout reference: the portal's "Civil Case Search User Guide" (Help menu). Controls are
 * located by visible placeholders, labels and section headings rather than generated ids.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

export const BASE_URL = "https://portal.schuylkill.pa.countysuite-azuregov.us/courts.civil.portal/";
const LOGIN_URL = BASE_URL + "Account/LogIn";
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

// Error snapshots always go to the scraper's git-ignored debug/ folder, regardless of cwd.
const DEBUG_FALLBACK = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "debug");

export class SessionExpiredError extends Error {}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Helpers installed into every document as window.__cs (browser context).
 * Kept as a plain function so Puppeteer can serialize it.
 */
function installHelpers() {
  const SECTION_HEADINGS = [
    "case participants", "additional information", "case dispositions",
    "case docket entries", "additional case documents", "case judgments", "list of cases"
  ];
  const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const lines = (el) => String(el?.innerText ?? "").split("\n").map(norm).filter(Boolean);
  const isVisible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  // Deepest elements whose full text equals `text` (case-insensitive).
  const findByExactText = (text, root = document) => {
    const want = norm(text).toLowerCase();
    return [...root.querySelectorAll("body *")]
      .filter(el => norm(el.textContent).toLowerCase() === want)
      .filter(el => ![...el.children].some(ch => norm(ch.textContent).toLowerCase() === want));
  };

  // Largest container that holds this section heading and no other known section heading.
  const findSection = (heading) => {
    const h = findByExactText(heading)[0];
    if (!h) return null;
    const others = SECTION_HEADINGS.filter(s => s !== heading.toLowerCase());
    let c = h;
    while (c.parentElement && c.parentElement !== document.body) {
      const txt = norm(c.parentElement.innerText).toLowerCase();
      if (others.some(o => findByExactText(o, c.parentElement).length)) break;
      if (!txt) break;
      c = c.parentElement;
    }
    return c;
  };

  // Parse every table under root into objects keyed by header text. Handles header/body split tables.
  const parseTable = (root) => {
    if (!root) return [];
    const headerRow = [...root.querySelectorAll("tr")].find(tr => tr.querySelector("th"));
    const headers = headerRow ? [...headerRow.querySelectorAll("th")].map(th => norm(th.innerText)) : [];
    const rows = [];
    for (const tr of root.querySelectorAll("tr")) {
      const tds = [...tr.querySelectorAll(":scope > td")];
      if (!tds.length || (tds.length === 1 && tds[0].colSpan > 1)) continue;
      const cells = tds.map(td => norm(td.innerText));
      const obj = { _cells: cells };
      cells.forEach((v, i) => {
        const key = headers.length === cells.length ? headers[i] : headers[i + headers.length - cells.length];
        if (key) obj[key] = v;
      });
      rows.push(obj);
    }
    return { headers, rows };
  };

  // "LABEL: value" pairs from an element's rendered text.
  const labelValues = (root, labels) => {
    const out = {};
    const text = String(root?.innerText ?? "");
    for (const label of labels) {
      const re = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:[ \\t]*(.*)$`, "im");
      const m = text.match(re);
      out[label] = m ? norm(m[1]) : "";
    }
    return out;
  };

  window.__cs = { norm, lines, isVisible, findByExactText, findSection, parseTable, labelValues };
}

export async function launchBrowser({ headful = false, slowMo = 0 } = {}) {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
    (fs.existsSync("/usr/bin/google-chrome-stable") ? "/usr/bin/google-chrome-stable" : undefined);
  return puppeteer.launch({
    executablePath,
    headless: !headful,
    slowMo,
    defaultViewport: { width: 1400, height: 1000 },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

export async function newPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  page.setDefaultTimeout(60000);
  await page.evaluateOnNewDocument(installHelpers);
  return page;
}

async function settle(page, ms = 500) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => { });
  await sleep(ms);
}

async function gotoAndSettle(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await settle(page);
  await ensureHelpers(page);
}

async function ensureHelpers(page) {
  const has = await page.evaluate(() => !!window.__cs).catch(() => false);
  if (!has) await page.evaluate(installHelpers);
}

function isLoginUrl(url) {
  return /\/Account\/Log[Ii]n/.test(url);
}

export async function saveDebug(page, dir, name) {
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, name.replace(/[^\w.-]+/g, "_"));
  fs.writeFileSync(base + ".html", await page.content());
  await page.screenshot({ path: base + ".png", fullPage: true }).catch(() => { });
  console.log(`  [debug] saved ${base}.html/.png (${page.url()})`);
}

export async function login(page, { username, password }, debugDir) {
  await gotoAndSettle(page, LOGIN_URL);
  await page.waitForSelector("input[name=AccountLogin]");
  await page.$eval("input[name=AccountLogin]", el => { el.value = ""; });
  await page.type("input[name=AccountLogin]", username, { delay: 20 });
  await page.$eval("input[name=Password]", el => { el.value = ""; });
  await page.type("input[name=Password]", password, { delay: 20 });

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => { }),
    page.evaluate(() => {
      const btn = document.querySelector("#login-panel input[type=submit], form[action*='Login'] input[type=submit], form[action*='Login'] button[type=submit]");
      if (btn) btn.click(); else document.querySelector("input[name=Password]").form.submit();
    })
  ]);
  await settle(page);
  await ensureHelpers(page);
  await saveDebug(page, debugDir, "01-after-login");

  const state = await page.evaluate(() => {
    const txt = document.body.innerText;
    const errors = [...document.querySelectorAll(".validation-summary-errors, .field-validation-error, .text-danger, .alert-danger")]
      .map(e => e.innerText.trim()).filter(Boolean);
    const logout = [...document.querySelectorAll("a, button")].some(a => /log\s*(out|off)|sign\s*out/i.test(a.textContent));
    const stillLoginForm = !!document.querySelector("input[name=AccountLogin]");
    return { errors, logout, stillLoginForm, hint: txt.slice(0, 400) };
  });
  if (state.errors.length || (!state.logout && state.stillLoginForm)) {
    throw new Error(`Login failed${state.errors.length ? ": " + state.errors.join(" | ") : " (login form still shown)"}`);
  }
  console.log("Logged in.");
}

/** From the logged-in home page, open the Civil Case Search page. */
export async function openCaseSearch(page, debugDir) {
  if (isLoginUrl(page.url())) throw new SessionExpiredError("On the login page while opening Case Search");
  await ensureHelpers(page);
  const hasForm = async () => page.evaluate(() => !!document.querySelector("input[placeholder='Search String']"));
  if (!(await hasForm())) {
    if (page.url().replace(/\/$/, "") !== BASE_URL.replace(/\/$/, "")) await gotoAndSettle(page, BASE_URL);
    const href = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find(x => /civil case search/i.test(x.textContent) && x.href && !x.classList.contains("disabled"));
      return a ? a.href : null;
    });
    if (!href) {
      await saveDebug(page, debugDir || DEBUG_FALLBACK, "error-no-case-search-link");
      throw new Error("'Civil Case Search' is not available after login. Check that the subscription is active.");
    }
    await gotoAndSettle(page, href);
  }
  if (isLoginUrl(page.url())) throw new SessionExpiredError("Redirected to login while opening Case Search");
  if (!(await hasForm())) {
    await saveDebug(page, debugDir || DEBUG_FALLBACK, "error-no-search-form");
    throw new Error("Case Search form not found (subscription may be inactive or the page layout changed). See debug/.");
  }
  await saveDebug(page, debugDir, "02-case-search");
  return page.url();
}

/** Type into an input; works for React-controlled inputs (uses the native value setter as a fallback). */
async function setInputValue(page, selectors, value) {
  let el = null, used = null;
  for (const sel of [].concat(selectors)) {
    el = await page.$(sel);
    if (el) { used = sel; break; }
  }
  if (!el) return false;
  await el.click({ clickCount: 3 });
  await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  if (value) await el.type(value, { delay: 15 });
  const ok = await page.evaluate((sel, v) => {
    const i = document.querySelector(sel);
    if (i.value === v) return true;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(i, v);
    for (const t of ["input", "change"]) i.dispatchEvent(new Event(t, { bubbles: true }));
    return i.value === v;
  }, used, value);
  await page.keyboard.press("Escape").catch(() => { });
  return ok;
}

async function selectSearchType(page, optionText) {
  const want = optionText.toLowerCase();
  // PrimeReact dropdown (the live portal): click the trigger, then the overlay item.
  if (await page.$("#caseSearchType")) {
    const current = async () => page.$eval("#caseSearchType .p-dropdown-label", el => el.innerText.trim().toLowerCase()).catch(() => "");
    if ((await current()) === want) return true;
    await page.click("#caseSearchType .p-dropdown-trigger, #caseSearchType");
    await page.waitForSelector(".p-dropdown-panel .p-dropdown-item", { visible: true, timeout: 10000 }).catch(() => { });
    await page.evaluate((w) => {
      const item = [...document.querySelectorAll(".p-dropdown-panel .p-dropdown-item")].find(li => li.innerText.trim().toLowerCase() === w);
      item?.click();
    }, want);
    await sleep(300);
    return (await current()) === want;
  }

  // Native <select>.
  return page.evaluate((w) => {
    const sel = [...document.querySelectorAll("select")].find(s => [...s.options].some(o => o.text.trim().toLowerCase() === w));
    if (!sel) return false;
    sel.value = [...sel.options].find(o => o.text.trim().toLowerCase() === w).value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, want);
}

async function setCheckboxByLabel(page, labelText, checked) {
  return page.evaluate((text, checked) => {
    const lab = window.__cs.findByExactText(text).find(el => el.tagName === "LABEL") || window.__cs.findByExactText(text)[0];
    if (!lab) return false;
    const input = (lab.htmlFor && document.getElementById(lab.htmlFor)) ||
      lab.querySelector?.("input[type=checkbox]") || lab.parentElement?.querySelector("input[type=checkbox]");
    if (!input) return false;
    if (input.checked !== checked) {
      // PrimeReact renders a visible .p-checkbox-box; the real input is visually hidden.
      const box = input.closest(".p-checkbox")?.querySelector(".p-checkbox-box");
      (box || input).click();
    }
    return input.checked === checked;
  }, labelText, checked);
}

/**
 * Fill the Case Search form and submit.
 * @param {{searchString:string, searchType?:string, startDate?:string, endDate?:string, judgmentsOnly?:boolean, includeAttorneys?:boolean}} q
 *   dates are MM/DD/YYYY or blank for no limit
 */
export async function runSearch(page, q, debugDir) {
  const searchType = q.searchType || "Participant Name";
  if (!(await selectSearchType(page, searchType))) {
    await saveDebug(page, debugDir || DEBUG_FALLBACK, "error-search-type");
    throw new Error(`Could not set Search Type to "${searchType}"`);
  }
  if (!(await setInputValue(page, ["input[name=userSearchString]", "input[placeholder='Search String']"], q.searchString))) {
    throw new Error("Could not enter the Search String");
  }
  await setInputValue(page, ["input[name=startDate]", "input[placeholder^='Start Date']"], q.startDate || "");
  await setInputValue(page, ["input[name=endDate]", "input[placeholder^='End Date']"], q.endDate || "");
  if (!(await setCheckboxByLabel(page, "Judgments Only", !!q.judgmentsOnly)) && q.judgmentsOnly) {
    throw new Error("Could not tick 'Judgments Only'");
  }
  await setCheckboxByLabel(page, "Include Attorneys In Name Search", !!q.includeAttorneys);

  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button, input[type=submit], input[type=button], a.btn")]
      .find(b => /^search$/i.test((b.innerText || b.value || "").trim()));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!clicked) await page.keyboard.press("Enter");

  const loaded = await page.waitForFunction(() => {
    const t = document.body.innerText;
    return /no cases found/i.test(t) || [...document.querySelectorAll("th")].some(th => /case number/i.test(th.innerText));
  }, { timeout: 90000 }).then(() => true, () => false);
  await settle(page, 800);
  await ensureHelpers(page);
  if (isLoginUrl(page.url())) throw new SessionExpiredError("Redirected to login after search");
  await saveDebug(page, debugDir, `03-results-${q.searchString}`);
  if (!loaded) {
    await saveDebug(page, debugDir || DEBUG_FALLBACK, "error-search-results");
    throw new Error(`Search "${q.searchString}" did not show a results table or "No cases found"`);
  }
}

/** Read the visible "List of Cases" table on the current results page. */
async function readResultsPage(page) {
  return page.evaluate(() => {
    const { parseTable, norm } = window.__cs;
    const table = [...document.querySelectorAll("table")].find(t => [...t.querySelectorAll("th")].some(th => /case number/i.test(th.innerText)));
    if (!table) return [];
    const root = table.closest(".dataTables_wrapper") || table.parentElement?.parentElement || table;
    const { headers, rows } = parseTable(root);
    const pIdx = headers.findIndex(h => /participant/i.test(h));
    const trs = [...root.querySelectorAll("tr")].filter(tr => tr.querySelector(":scope > td") && !(tr.querySelectorAll(":scope > td").length === 1 && tr.querySelector("td").colSpan > 1));

    return rows.map((r, i) => {
      const tr = trs[i];
      const pick = (re) => { const k = Object.keys(r).find(k => re.test(k)); return k ? r[k] : ""; };
      const tds = tr ? [...tr.querySelectorAll(":scope > td")] : [];
      const participantsText = pIdx >= 0 ? tds[pIdx + tds.length - headers.length]?.innerText ?? "" : "";
      const listParticipants = participantsText.split("\n").map(norm).filter(Boolean).map(line => {
        const m = line.match(/^([A-Za-z]{2,4}):\s*(.*)$/);
        return m ? { prefix: m[1], name: m[2].replace(/,$/, "") } : { prefix: "", name: line.replace(/,$/, "") };
      });

      // Detail link: anchor href, data-* attribute, or a URL inside an onclick handler.
      let detailUrl = "";
      if (tr) {
        const a = [...tr.querySelectorAll("a[href]")].find(x => !/^(#|javascript:)/i.test(x.getAttribute("href")));
        if (a) detailUrl = a.href;
        const dataEl = [tr, ...tr.querySelectorAll("*")].find(e => e.dataset && (e.dataset.href || e.dataset.url || e.dataset.link));
        if (!detailUrl && dataEl) detailUrl = new URL(dataEl.dataset.href || dataEl.dataset.url || dataEl.dataset.link, location.href).href;
        const onclick = [tr, ...tr.querySelectorAll("[onclick]")].map(e => e.getAttribute("onclick") || "").find(Boolean) || "";
        const m = onclick.match(/['"]([^'"]*(?:Case|Detail)[^'"]*)['"]/i);
        if (!detailUrl && m) detailUrl = new URL(m[1], location.href).href;
      }

      const caseNumber = (pick(/case number/i) || r._cells[0] || "").split(" ")[0];
      const opened = pick(/opened/i);
      return {
        caseNumber,
        participantsText: norm(participantsText),
        plaintiffs: listParticipants.filter(p => /^pla/i.test(p.prefix)).map(p => p.name).join("; "),
        defendants: listParticipants.filter(p => /^def/i.test(p.prefix)).map(p => p.name).join("; "),
        listParticipants,
        caseCategory: pick(/category/i),
        contactName: pick(/contact/i),
        creditor: pick(/creditor/i),
        debtor: pick(/debtor/i),
        judgmentAmount: pick(/amount/i),
        opened: (opened.match(/\d{1,2}\/\d{1,2}\/\d{4}/) || [""])[0],
        status: pick(/status/i),
        detailUrl,
        rowIndex: i
      };
    }).filter(r => r.caseNumber && !/no cases found/i.test(r.caseNumber));
  });
}

/** For rows without a detail URL: click the row, capture the navigation target, and abort it. */
async function captureDetailUrlsByClick(page, rows) {
  const missing = rows.filter(r => !r.detailUrl);
  if (!missing.length) return;
  await page.setRequestInterception(true);
  let captured = null;
  const onRequest = (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame() && req.method() === "GET" && !captured) {
      captured = req.url();
      // A 204 response cancels the navigation and leaves the results page intact (abort() shows an error page).
      req.respond({ status: 204, body: "" }).catch(() => { });
    } else {
      req.continue().catch(() => { });
    }
  };
  page.on("request", onRequest);
  try {
    for (const r of missing) {
      captured = null;
      await page.evaluate((caseNumber) => {
        const tr = [...document.querySelectorAll("tr")].find(t => t.querySelector("td") && t.querySelector("td").innerText.trim().startsWith(caseNumber));
        (tr?.querySelector("a, td") || tr)?.click();
      }, r.caseNumber);
      for (let i = 0; i < 30 && !captured; i++) await sleep(100);
      if (captured) r.detailUrl = captured;
    }
  } finally {
    page.off("request", onRequest);
    await page.setRequestInterception(false);
  }
}

async function goNextResultsPage(page) {
  const snapshot = () => page.evaluate(() => document.querySelector("table tbody")?.innerText?.trim() ?? "");
  const before = await snapshot();
  const clicked = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll(".p-paginator-next, a, button, li")].filter(el => {
      const t = (el.innerText || "").trim();
      const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      return el.matches(".p-paginator-next") || /^(next|›|»|>)$/i.test(t) || /^(show )?next/i.test(label) || el.classList.contains("next");
    });
    const enabled = candidates.find(el => window.__cs.isVisible(el) &&
      !el.matches(".disabled, .p-disabled, [disabled], [aria-disabled=true]") && !el.closest(".disabled"));
    if (!enabled) return false;
    (enabled.matches("li") ? enabled.querySelector("a, button") || enabled : enabled).click();
    return true;
  });
  if (!clicked) return false;
  const advanced = await page.waitForFunction((prev) => (document.querySelector("table tbody")?.innerText?.trim() ?? "") !== prev,
    { timeout: 30000 }, before).then(() => true, () => false);
  await settle(page, 500);
  if (!advanced) throw new Error("Clicked the results 'Next' control but the page did not advance; results would be incomplete");
  return true;
}

/** Try to show the maximum rows per page if the results table offers a page-size selector. */
async function maximizePageSize(page) {
  const changed = await page.evaluate(() => {
    const sel = [...document.querySelectorAll("select")].find(s => s.options.length > 1 && [...s.options].every(o => /^\d+$|^all$/i.test(o.text.trim())));
    if (!sel) return false;
    const best = [...sel.options].sort((a, b) => (/all/i.test(b.text) ? 1e9 : +b.text) - (/all/i.test(a.text) ? 1e9 : +a.text))[0];
    if (sel.value === best.value) return false;
    sel.value = best.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.jQuery) window.jQuery(sel).trigger("change");
    return true;
  });
  if (changed) await settle(page, 800);
}

/** Collect all result rows across pages, resolving each row's detail URL. */
export async function collectResults(page, { maxRows = 0, debugDir } = {}) {
  const noCases = await page.evaluate(() => /no cases found/i.test(document.body.innerText));
  if (noCases) return [];
  await maximizePageSize(page);

  const all = [];
  for (let pageNo = 1; pageNo <= 500; pageNo++) {
    const rows = await readResultsPage(page);
    await captureDetailUrlsByClick(page, rows);
    all.push(...rows);
    console.log(`  results page ${pageNo}: ${rows.length} rows (${rows.filter(r => r.detailUrl).length} with detail links)`);
    if (pageNo === 1 && rows.length && !rows.some(r => r.detailUrl)) await saveDebug(page, debugDir || DEBUG_FALLBACK, "warn-no-detail-links");
    if (maxRows > 0 && all.length >= maxRows) break;
    if (!(await goNextResultsPage(page))) break;
    if (debugDir && pageNo === 1) await saveDebug(page, debugDir, "04-results-page-2");
  }
  return all;
}

/** Cycle the Case Participants carousels (Plaintiff (1 of 2) ...) and read every participant. */
async function readParticipants(page) {
  // Live portal: PrimeReact carousels keep every item in the DOM, so read them directly.
  const direct = await page.evaluate(() => {
    const { norm } = window.__cs;
    const stacks = [...document.querySelectorAll(".participants-container .participant-stacked-carousel")];
    if (!stacks.length) return null;
    const out = [];
    for (const stack of stacks) {
      const roleOf = (c) => norm(c.querySelector(".title .p-text-bold")?.innerText || "");
      const containers = [...stack.querySelectorAll(".carousel-container")];
      const side = roleOf(stack.querySelector(".carousel-container.top") || containers[0]);
      for (const c of containers) {
        const role = roleOf(c);
        const [, total] = norm(c.querySelector(".title")?.innerText || "").match(/\(\d+\s+of\s+(\d+)\)/) || [];
        const items = [...c.querySelectorAll(".p-carousel-item .participant")];
        for (const p of items) {
          const [nameItem, addrItem] = p.querySelectorAll(":scope > .item");
          const name = norm(nameItem?.querySelector(".p-text-bold")?.innerText || "");
          if (!name) continue;
          const address = [...(addrItem?.children || [])].map(d => norm(d.innerText)).filter(Boolean).join(", ");
          out.push({ side, role, name, address, primary: /\(primary\)/i.test(nameItem.innerText) });
        }
        if (total !== undefined && items.length !== +total) out.push({ warn: `read ${items.length} of ${total} ${role} participants` });
      }
    }
    return out;
  });
  if (direct) {
    for (const w of direct.filter(p => p.warn)) console.warn(`  [WARN] ${w.warn}`);
    return direct.filter(p => !p.warn);
  }

  const groups = await page.evaluate(() => {
    const { findSection, norm } = window.__cs;
    const sec = findSection("case participants") || document.body;
    const HEADER = /^([A-Za-z][A-Za-z /&'-]*?)\s*\((\d+)\s+of\s+(\d+)\)$/;
    const headers = [...sec.querySelectorAll("*")]
      .filter(el => HEADER.test(norm(el.innerText)) && ![...el.children].some(ch => HEADER.test(norm(ch.innerText))));
    const out = [];
    headers.forEach((h, i) => {
      let card = h;
      while (card.parentElement && card.parentElement !== sec &&
        headers.filter(o => card.parentElement.contains(o)).length === 1) card = card.parentElement;
      card.setAttribute("data-cs-group", String(i));
      const [, role, idx, total] = norm(h.innerText).match(HEADER);
      // Side = the non-attorney role in the same column (Plaintiff / Defendant / ...).
      let side = /attorney/i.test(role) ? "" : role;
      for (let c = card.parentElement; !side && c && c !== sec.parentElement; c = c.parentElement) {
        const other = headers.find(o => c.contains(o) && !/attorney/i.test(norm(o.innerText)));
        if (other) side = norm(other.innerText).match(HEADER)[1];
      }
      out.push({ group: i, role: norm(role), side, index: +idx, total: +total, headerText: norm(h.innerText) });
    });
    return out;
  });

  const readEntry = (g) => page.evaluate((group, headerText) => {
    const { lines } = window.__cs;
    const card = document.querySelector(`[data-cs-group="${group}"]`);
    const ls = lines(card).filter(l => !/^\(?\d+\s+of\s+\d+\)?$/.test(l) && !/^[‹›<>]$/.test(l));
    const hdr = ls.findIndex(l => /\(\d+\s+of\s+\d+\)/.test(l));
    const body = ls.slice(hdr + 1);
    const nameLine = body[0] || "";
    return {
      counter: ls[hdr] || headerText,
      name: nameLine.replace(/\s*\((primary|secondary)\)\s*$/i, "").trim(),
      primary: /\(primary\)/i.test(nameLine),
      address: body.slice(1).join(", ")
    };
  }, g.group, g.headerText);

  const participants = [];
  for (const g of groups) {
    const seen = new Set();
    let entry = await readEntry(g);
    for (let n = 0; n < g.total; n++) {
      const key = `${entry.name}|${entry.address}`;
      if (entry.name && !seen.has(key)) {
        seen.add(key);
        participants.push({ side: g.side, role: g.role, name: entry.name, address: entry.address, primary: entry.primary });
      }
      if (seen.size >= g.total) break;
      const before = await page.evaluate((group) => document.querySelector(`[data-cs-group="${group}"]`)?.innerText ?? "", g.group);
      const moved = await page.evaluate((group) => {
        const card = document.querySelector(`[data-cs-group="${group}"]`);
        const ctrls = [...card.querySelectorAll("a, button, span, i, div")].filter(el => {
          const sig = `${el.className} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""} ${(el.innerText || "").trim()}`;
          return /next|right|›|»/i.test(sig) && window.__cs.isVisible(el);
        });
        const ctl = ctrls.at(-1);
        if (!ctl) return false;
        (ctl.closest("a, button") || ctl).click();
        return true;
      }, g.group);
      if (!moved) break;
      await page.waitForFunction((group, prev) => {
        const t = document.querySelector(`[data-cs-group="${group}"]`)?.innerText ?? "";
        return t !== prev;
      }, { timeout: 5000 }, g.group, before).catch(() => { });
      await sleep(250);
      entry = await readEntry(g);
    }
    if (seen.size < g.total) console.warn(`  [WARN] read ${seen.size} of ${g.total} ${g.role} participants`);
  }
  return participants;
}

/** Open a case detail page and extract all sections. */
export async function scrapeCaseDetail(page, url, { debugDir, saveHtmlDir } = {}) {
  await gotoAndSettle(page, url);
  if (isLoginUrl(page.url())) throw new SessionExpiredError(`Redirected to login opening ${url}`);
  const ok = await page.waitForFunction(() => /case participants/i.test(document.body.innerText) && /case docket entries|case judgments/i.test(document.body.innerText), { timeout: 60000 })
    .then(() => true, () => false);
  if (!ok) {
    await saveDebug(page, debugDir || DEBUG_FALLBACK, "error-case-detail");
    throw new Error(`Not a case detail page: ${page.url()}`);
  }

  const base = await page.evaluate(() => {
    const { findSection, parseTable, labelValues, lines } = window.__cs;

    // Header card: everything in <main> before the CASE PARTICIPANTS section.
    const mainLines = lines(document.querySelector("main") || document.body);
    const stop = mainLines.findIndex(l => /^case participants$/i.test(l));
    const head = mainLines.slice(0, stop > 0 ? stop : 12)
      .filter(l => !/^(case details|search|>\s*case details|summary|print|home|log ?out|log ?off|help)$/i.test(l) && !/^countysuite/i.test(l));
    const statusIdx = head.findIndex(l => /^(open|closed|inactive|reopened|re-opened|pending|active|discontinued|satisfied)$/i.test(l));
    const status = statusIdx >= 0 ? head[statusIdx] : "";
    const numIdx = head.findIndex(l => /^[A-Z0-9]{1,6}(-[A-Z0-9]{1,8}){1,3}$/i.test(l) && /\d/.test(l));
    const rest = head.filter((_, i) => i !== statusIdx && i !== numIdx);
    const caption = rest.find(l => /\bvs?\.?\b/i.test(l)) || rest[0] || "";
    const caseType = numIdx >= 0 ? (head.slice(numIdx + 1).find((l, i) => numIdx + 1 + i !== statusIdx && l !== caption) || "") : "";

    const info = labelValues(findSection("additional information"),
      ["DATE FILED", "STATUS", "DATE CLOSED", "DAYS OPEN", "FINAL", "AOPC", "DIVORCE", "CUSTODY", "REFERENCE NUMBERS", "COMMENCEMENT", "NOTES"]);

    // Prefer short headers: the live dockets table also has hidden checkbox headers like "toggle selection of all docket attachments".
    const pick = (row, re) => { const k = Object.keys(row).filter(k => re.test(k)).sort((a, b) => a.length - b.length)[0]; return k ? row[k] : ""; };

    const dispositions = parseTable(findSection("case dispositions")).rows?.map(r => ({
      date: pick(r, /date/i), category: pick(r, /category/i), result: pick(r, /result/i)
    })).filter(d => d.date || d.result) ?? [];

    const dockets = parseTable(findSection("case docket entries")).rows?.map(r => ({
      date: pick(r, /date/i), category: pick(r, /category/i), description: pick(r, /description/i), attachments: pick(r, /attach/i)
    })).filter(d => /\d{1,2}\/\d{1,2}\/\d{4}/.test(d.date)) ?? [];

    const judgments = parseTable(findSection("case judgments")).rows?.map(r => ({
      date: pick(r, /date/i), creditor: pick(r, /creditor/i), debtor: pick(r, /debtor/i),
      description: pick(r, /description/i), amount: pick(r, /amount/i)
    })).filter(j => j.date || j.amount) ?? [];

    return {
      caseNumber: numIdx >= 0 ? head[numIdx] : "",
      caption, caseType, status,
      dateFiled: info["DATE FILED"], statusDetail: info["STATUS"], dateClosed: info["DATE CLOSED"], daysOpen: info["DAYS OPEN"],
      dispositionFinal: info["FINAL"], dispositionAopc: info["AOPC"],
      referenceNumbers: info["REFERENCE NUMBERS"], commencement: info["COMMENCEMENT"], notes: info["NOTES"],
      dispositions, dockets, judgments
    };
  });

  const participants = await readParticipants(page);

  if (saveHtmlDir) {
    fs.mkdirSync(saveHtmlDir, { recursive: true });
    fs.writeFileSync(path.join(saveHtmlDir, `${(base.caseNumber || "case").replace(/[^\w.-]+/g, "_")}.html`), await page.content());
  }
  if (debugDir) await saveDebug(page, debugDir, `05-case-${base.caseNumber || "unknown"}`);

  return { ...base, status: base.status || base.statusDetail, participants, detailUrl: page.url() };
}
