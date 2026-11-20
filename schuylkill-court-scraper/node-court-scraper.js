#!/usr/bin/env node
/**
 * Schuylkill County (CountySuite) civil portal scraper for Lake Wynonah litigation.
 *
 *  1. Logs in with the local, git-ignored credentials.json (see credentials.example.json).
 *  2. Runs Participant Name searches (default "%wynonah%") across all case dates.
 *  3. Opens every case and extracts header, participants, details/disposition, dockets and judgments.
 *  4. Classifies Lake Wynonah's role, judgments in its favor, likely dues-collection cases and liens.
 *  5. Writes output/ (current status) and history/ (dated snapshots, case ledger, changes since last run).
 *
 * Usage: node node-court-scraper.js [options]   (see --help or README.md)
 */
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { fileURLToPath } from "url";

import { loadCredentials } from "./lib/credentials.js";
import {
  BASE_URL, SessionExpiredError, launchBrowser, newPage, login, openCaseSearch,
  runSearch, collectResults, scrapeCaseDetail, sleep
} from "./lib/portal.js";
import {
  DEFAULT_ORG_PATTERN, analyzeCase, caseCsvRow, toCSV, isOrg,
  CASE_COLUMNS, JUDGMENT_COLUMNS, DOCKET_COLUMNS, PARTICIPANT_COLUMNS
} from "./lib/analyze.js";
import { loadJson, writeJson, findPreviousSnapshot, updateLedger, diffCases } from "./lib/history.js";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SEARCHES = ["%wynonah%", "%lwpoa%"];

const HELP = `Usage: node node-court-scraper.js [options]

  --search <pattern>     Participant Name search string; repeatable (default: ${DEFAULT_SEARCHES.join(", ")})
  --start <MM/DD/YYYY>   Only cases opened on/after this date (default: no limit)
  --end <MM/DD/YYYY>     Only cases opened on/before this date (default: no limit)
  --judgments-only       Tick the portal's "Judgments Only" filter
  --max <n>              Only open the first n cases (test run; history is not updated)
  --delay <ms>           Pause between case pages (default 1500)
  --discover             Save HTML + screenshots of each step to debug/ and stop after 2 cases
  --save-html            Keep each case detail page in output/html/
  --reanalyze            Re-run analysis on output/cases-raw.json without contacting the portal
  --headful              Show the browser window
  --slow-mo <ms>         Slow down browser actions (debugging)
  --credentials <file>   Credentials JSON (default: credentials.json in this directory)
  --out <dir>            Output directory (default: output/)
  -h, --help             Show this help`;

const { values: opt } = parseArgs({
  options: {
    search: { type: "string", multiple: true },
    start: { type: "string", default: "" },
    end: { type: "string", default: "" },
    "judgments-only": { type: "boolean", default: false },
    max: { type: "string", default: "0" },
    delay: { type: "string", default: "1500" },
    discover: { type: "boolean", default: false },
    "save-html": { type: "boolean", default: false },
    reanalyze: { type: "boolean", default: false },
    headful: { type: "boolean", default: false },
    "slow-mo": { type: "string", default: "0" },
    credentials: { type: "string" },
    out: { type: "string", default: path.join(APP_DIR, "output") },
    help: { type: "boolean", short: "h", default: false }
  }
});

if (opt.help) {
  console.log(HELP);
  process.exit(0);
}

for (const d of ["start", "end"]) {
  if (opt[d] && !/^\d{2}\/\d{2}\/\d{4}$/.test(opt[d])) {
    console.error(`--${d} must be MM/DD/YYYY`);
    process.exit(2);
  }
}

const searches = opt.search?.length ? opt.search : DEFAULT_SEARCHES;
const maxCases = opt.discover ? 2 : Number(opt.max) || 0;
const partialRun = maxCases > 0 || !!opt.start || !!opt.end || opt["judgments-only"] || !!opt.search?.length;
const delayMs = Number(opt.delay) || 0;
const OUT_DIR = path.resolve(opt.out);
const HISTORY_DIR = path.join(APP_DIR, "history");
const DEBUG_DIR = opt.discover ? path.join(APP_DIR, "debug") : null;
const RAW_FILE = path.join(OUT_DIR, "cases-raw.json");
const LEDGER_FILE = path.join(HISTORY_DIR, "case-ledger.json");

function localDate(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function scrapePortal() {
  const creds = loadCredentials(opt.credentials);
  const browser = await launchBrowser({ headful: opt.headful, slowMo: Number(opt["slow-mo"]) || 0 });
  const page = await newPage(browser);
  const rawCases = [];

  try {
    await login(page, creds, DEBUG_DIR);
    const searchUrl = await openCaseSearch(page, DEBUG_DIR);

    const byCase = new Map();
    for (const s of searches) {
      console.log(`\n=== Participant Name search "${s}"${opt.start || opt.end ? ` opened ${opt.start || "*"} .. ${opt.end || "*"}` : ""} ===`);
      if (page.url() !== searchUrl) await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
      await openCaseSearch(page);
      await runSearch(page, {
        searchString: s, searchType: "Participant Name",
        startDate: opt.start, endDate: opt.end, judgmentsOnly: opt["judgments-only"]
      }, DEBUG_DIR);
      const rows = await collectResults(page, { maxRows: maxCases, debugDir: DEBUG_DIR });
      for (const r of rows) {
        const prev = byCase.get(r.caseNumber);
        byCase.set(r.caseNumber, { ...r, ...prev, detailUrl: prev?.detailUrl || r.detailUrl, searches: [...(prev?.searches ?? []), s] });
      }
      console.log(`  ${rows.length} rows, ${byCase.size} unique cases so far`);
    }

    const rows = [...byCase.values()];
    const todo = maxCases > 0 ? rows.slice(0, maxCases) : rows;
    console.log(`\nOpening ${todo.length} case(s)...`);

    let i = 0;
    for (const row of todo) {
      i++;
      const { rowIndex, ...listRow } = row;
      if (!row.detailUrl) {
        console.warn(`[${i}/${todo.length}] ${row.caseNumber}: no detail link found; using results-row data only`);
        rawCases.push({ caseNumber: row.caseNumber, status: row.status, listRow, scrapeError: "no detail link" });
        continue;
      }
      console.log(`[${i}/${todo.length}] ${row.caseNumber}`);
      let detail = null;
      for (let attempt = 1; attempt <= 2 && !detail; attempt++) {
        try {
          detail = await scrapeCaseDetail(page, row.detailUrl, {
            debugDir: DEBUG_DIR,
            saveHtmlDir: opt["save-html"] ? path.join(OUT_DIR, "html") : null
          });
        } catch (e) {
          if (e instanceof SessionExpiredError && attempt === 1) {
            console.warn("  session expired; logging in again");
            await login(page, creds, DEBUG_DIR);
          } else if (attempt === 2) {
            console.error(`  [ERROR] ${e.message}`);
          } else {
            console.warn(`  retrying after error: ${e.message}`);
            await sleep(3000);
          }
        }
      }
      rawCases.push(detail
        ? { ...detail, caseNumber: row.caseNumber || detail.caseNumber, detailCaseNumber: detail.caseNumber, listRow }
        : { caseNumber: row.caseNumber, status: row.status, listRow, detailUrl: row.detailUrl, scrapeError: "detail page failed" });
      await sleep(delayMs);
    }
  } finally {
    await browser.close();
  }
  return rawCases;
}

function writeOutputs(cases, meta) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeJson(path.join(OUT_DIR, "cases.json"), { ...meta, cases });
  fs.writeFileSync(path.join(OUT_DIR, "cases.csv"), toCSV(cases.map(caseCsvRow), CASE_COLUMNS));
  fs.writeFileSync(path.join(OUT_DIR, "judgments.csv"),
    toCSV(cases.flatMap(c => c.judgments.map(j => ({ ...j, caseNumber: c.caseNumber, caption: c.caption }))), JUDGMENT_COLUMNS));
  fs.writeFileSync(path.join(OUT_DIR, "dockets.csv"),
    toCSV(cases.flatMap(c => c.dockets.map(d => ({ ...d, caseNumber: c.caseNumber }))), DOCKET_COLUMNS));
  fs.writeFileSync(path.join(OUT_DIR, "participants.csv"),
    toCSV(cases.flatMap(c => c.participants.map(p => ({ ...p, caseNumber: c.caseNumber, isLW: isOrg(p.name, DEFAULT_ORG_PATTERN) }))), PARTICIPANT_COLUMNS));
}

function printSummary(cases, changes) {
  const count = (fn) => cases.filter(fn).length;
  const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tally = (key) => Object.entries(cases.reduce((a, c) => ((a[c[key] || "(blank)"] = (a[c[key] || "(blank)"] ?? 0) + 1), a), {}))
    .map(([k, v]) => `${k}: ${v}`).join(", ");
  console.log(`\nCases: ${cases.length} (open ${count(c => /open/i.test(c.status))}, closed ${count(c => /closed/i.test(c.status))})`);
  console.log(`By role: ${tally("caseKind")}`);
  console.log(`Dues-collection classification: ${tally("duesClass")}`);
  console.log(`Judgments for LW: ${money(cases.reduce((a, c) => a + c.judgmentTotalForLW, 0))} total, ` +
    `${money(cases.reduce((a, c) => a + c.judgmentOpenForLW, 0))} not marked satisfied, across ${count(c => c.judgmentTotalForLW > 0)} cases`);
  const poa = cases.filter(c => c.lwEntity !== "Municipal Authority");
  console.log(`  POA only (excl. Municipal Authority): ${money(poa.reduce((a, c) => a + c.judgmentTotalForLW, 0))} total, ` +
    `${money(poa.reduce((a, c) => a + c.judgmentOpenForLW, 0))} not marked satisfied`);
  console.log(`By LW entity: ${tally("lwEntity")}`);
  console.log(`Lien indicators: ${count(c => c.lienIndicator)} cases`);
  const errors = cases.filter(c => c.scrapeError);
  if (errors.length) console.log(`Scrape problems: ${errors.length} (${errors.map(c => c.caseNumber).join(", ")})`);
  if (changes) {
    console.log(`\nChanges since previous snapshot: ${changes.length}`);
    for (const c of changes.slice(0, 50)) console.log(`  ${c.type.padEnd(24)} ${c.caseNumber.padEnd(18)} ${c.detail}`);
    if (changes.length > 50) console.log(`  ...and ${changes.length - 50} more (see output/changes.json)`);
  }
}

(async () => {
  const runDate = localDate();
  let raw;
  if (opt.reanalyze) {
    raw = loadJson(RAW_FILE, null);
    if (!raw) throw new Error(`${RAW_FILE} not found; run a scrape first.`);
    console.log(`Re-analyzing ${raw.cases.length} cases scraped at ${raw.scrapedAt}`);
  } else {
    const cases = await scrapePortal();
    raw = { scrapedAt: new Date().toISOString(), baseUrl: BASE_URL, searches, dateRange: { start: opt.start, end: opt.end }, partialRun, cases };
    writeJson(RAW_FILE, raw);
  }

  const cases = raw.cases
    .map(c => analyzeCase(c))
    .sort((a, b) => (b.openedDateIso || "").localeCompare(a.openedDateIso || "") || a.caseNumber.localeCompare(b.caseNumber));

  const ledger = loadJson(LEDGER_FILE, { cases: {} });
  let changes = null;
  if (!opt.reanalyze && !raw.partialRun) {
    const prevFile = findPreviousSnapshot(path.join(HISTORY_DIR, "snapshots"), runDate);
    // A case whose detail page failed this run keeps its last good record so history isn't corrupted.
    const prevByNumber = new Map((prevFile ? loadJson(prevFile, { cases: [] }).cases : []).map(c => [c.caseNumber, c]));
    for (let i = 0; i < cases.length; i++) {
      const prev = prevByNumber.get(cases[i].caseNumber);
      if (cases[i].scrapeError && prev && !prev.scrapeError) {
        cases[i] = { ...prev, scrapeError: cases[i].scrapeError, carriedForwardFrom: prev.lastSeen || path.basename(prevFile) };
      }
    }
    updateLedger(ledger, cases, runDate);
    writeJson(LEDGER_FILE, ledger);
    writeJson(path.join(HISTORY_DIR, "snapshots", `cases-${runDate}.json`), { scrapedAt: raw.scrapedAt, cases });
    if (prevFile) {
      changes = diffCases(loadJson(prevFile, { cases: [] }).cases, cases);
      writeJson(path.join(OUT_DIR, "changes.json"), { runDate, comparedTo: path.basename(prevFile), changes });
      writeJson(path.join(HISTORY_DIR, "changes", `changes-${runDate}.json`), { runDate, comparedTo: path.basename(prevFile), changes });
    } else {
      console.log("\nNo earlier snapshot: this run is the history baseline.");
    }
  } else {
    // Annotate from the ledger without modifying it (test, filtered, or re-analysis run).
    for (const c of cases) Object.assign(c, {
      firstSeen: ledger.cases[c.caseNumber]?.firstSeen ?? "",
      lastSeen: ledger.cases[c.caseNumber]?.lastSeen ?? "",
      statusHistory: ledger.cases[c.caseNumber]?.statusHistory ?? []
    });
    if (raw.partialRun) console.log("\nPartial/filtered run: history snapshot and ledger NOT updated.");
  }

  writeOutputs(cases, { scrapedAt: raw.scrapedAt, analyzedAt: new Date().toISOString(), searches: raw.searches, dateRange: raw.dateRange, partialRun: raw.partialRun });
  printSummary(cases, changes);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT_DIR) || "."}/cases.csv, judgments.csv, dockets.csv, participants.csv, cases.json`);
})().catch(e => {
  console.error(`\nFAILED: ${e.message}`);
  process.exit(1);
});
