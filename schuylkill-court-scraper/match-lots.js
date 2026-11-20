#!/usr/bin/env node
/**
 * Cross-reference dues-collection cases (LW plaintiff) to Lake Wynonah lots.
 * Reads output/cases.json (from a scrape) and the lwlots data set; writes
 * output/lot-matches.csv (every candidate lot) and output/case-lots.csv (one row per case).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "util";
import { toCSV } from "./lib/analyze.js";
import { buildLotIndex, matchCaseToLots, summarizeByLot } from "./lib/lotmatch.js";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const LWLOTS_DIR = path.join(APP_DIR, "..", "lwlots");

const { values: opt } = parseArgs({
  options: {
    lots: { type: "string", default: path.join(LWLOTS_DIR, "4-lot-normalized.json") },
    "lot-history": { type: "string", default: path.join(LWLOTS_DIR, "history") },
    cases: { type: "string", default: path.join(APP_DIR, "output", "cases.json") },
    out: { type: "string", default: path.join(APP_DIR, "output") },
    "min-score": { type: "string", default: "25" },
    all: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false }
  }
});

if (opt.help) {
  console.log(`Usage: node match-lots.js [options]
  --lots <file>          lot data (default ../lwlots/4-lot-normalized.json)
  --lot-history <dir>    older lot snapshots for past mailing addresses (default ../lwlots/history)
  --cases <file>         analyzed cases (default output/cases.json)
  --min-score <n>        drop candidates below this score (default 25)
  --all                  all LW-plaintiff cases, not only duesClass likely/possible`);
  process.exit(0);
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const lots = readJson(opt.lots);

const mailingHistory = [];
if (fs.existsSync(opt["lot-history"])) {
  for (const dir of fs.readdirSync(opt["lot-history"]).sort()) {
    const f = path.join(opt["lot-history"], dir, "4-lot-normalized.json");
    if (!fs.existsSync(f)) continue;
    for (const l of readJson(f)) mailingHistory.push({ lot: l.lot, address: l.address, snapshot: dir.slice(0, 10) });
  }
}
const index = buildLotIndex(lots, mailingHistory);

const NON_PARTY = /attorney|counsel|garnishee/i;
const cases = readJson(opt.cases).cases.filter(c =>
  c.lwRole === "Plaintiff" && c.lwEntity !== "Municipal Authority" && (opt.all || ["likely", "possible"].includes(c.duesClass)));

// Old dockets (e.g. J-1395-1985) show a recent "opened" date; the case-number year is the real filing year.
function filedDate(c) {
  const year = (c.caseNumber.match(/-(\d{4})$/) || [])[1];
  if (year && (!c.openedDateIso || year < c.openedDateIso.slice(0, 4))) return `${year}-07-01`;
  return c.openedDateIso;
}

const matchRows = [];
const caseRows = [];
for (const c of cases) {
  const defendants = c.participants.filter(p => p.side === "Defendant" && !NON_PARTY.test(p.role ?? ""))
    .map(p => ({ name: p.name, address: p.address }));
  const cands = matchCaseToLots({ caseNumber: c.caseNumber, filedIso: filedDate(c), defendants }, index, { minScore: Number(opt["min-score"]) });
  const base = {
    caseNumber: c.caseNumber, openedDate: c.openedDate, status: c.status, duesClass: c.duesClass,
    judgmentOpenForLW: c.judgmentOpenForLW, lienIndicator: c.lienIndicator,
    defendants: defendants.map(d => d.name).join("; "),
    defendantAddresses: [...new Set(defendants.map(d => d.address).filter(Boolean))].join("; ")
  };
  const best = cands[0];
  const filedYear = (filedDate(c) ?? "").slice(0, 4);
  cands.forEach((m, i) => matchRows.push({ ...base, filedYear, rank: i + 1, isBest: m.score === best.score, ...m }));
  // "ambiguous" = several lots tie at the top score (e.g. one owner with adjacent lots).
  const top = cands.filter(m => best && m.score === best.score);
  caseRows.push({
    ...base,
    matchConfidence: best?.confidence ?? "none",
    bestLots: top.map(m => m.lot).join("; "),
    bestParcels: top.map(m => m.parcel).join("; "),
    bestLocations: top.map(m => m.location).join("; "),
    bestScore: best?.score ?? "",
    bestReasons: best?.reasons ?? "",
    defendantStillOwns: best?.defendantStillOwns ?? "",
    currentOwners: [...new Set(top.map(m => m.currentOwners))].join(" | "),
    candidateCount: cands.length,
    otherCandidates: cands.filter(m => !top.includes(m)).slice(0, 5).map(m => `${m.lot} (${m.confidence} ${m.score})`).join("; ")
  });
}

const MATCH_COLUMNS = ["caseNumber", "openedDate", "status", "duesClass", "judgmentOpenForLW", "lienIndicator", "defendants", "defendantAddresses",
  "rank", "lot", "parcel", "location", "score", "confidence", "reasons", "matchedOwners", "defendantStillOwns", "currentOwners", "mailingAddress"];
const CASE_LOT_COLUMNS = ["caseNumber", "openedDate", "status", "duesClass", "judgmentOpenForLW", "lienIndicator", "defendants", "defendantAddresses",
  "matchConfidence", "bestLots", "bestParcels", "bestLocations", "bestScore", "bestReasons", "defendantStillOwns", "currentOwners", "candidateCount", "otherCandidates"];

const lotSummary = summarizeByLot(matchRows);
const LOT_SUMMARY_COLUMNS = ["lot", "parcel", "location", "currentOwners", "litigationLikelihood", "likelihoodBand", "likelyCases",
  "casesHigh", "casesMedium", "casesLow", "alternativeCases", "openJudgmentCases", "firstFiled", "lastFiled", "cases", "defendants"];

fs.mkdirSync(opt.out, { recursive: true });
fs.writeFileSync(path.join(opt.out, "lot-summary.csv"), toCSV(lotSummary, LOT_SUMMARY_COLUMNS));
fs.writeFileSync(path.join(opt.out, "lot-matches.csv"), toCSV(matchRows, MATCH_COLUMNS));
fs.writeFileSync(path.join(opt.out, "case-lots.csv"), toCSV(caseRows, CASE_LOT_COLUMNS));
fs.writeFileSync(path.join(opt.out, "lot-matches.json"), JSON.stringify({ generatedAt: new Date().toISOString(), lotsFile: opt.lots, cases: caseRows, matches: matchRows, lots: lotSummary }, null, 2));

const tally = caseRows.reduce((a, r) => ((a[r.matchConfidence] = (a[r.matchConfidence] ?? 0) + 1), a), {});
console.log(`Lots: ${lots.length} (+${mailingHistory.length} historical mailing records). Cases: ${cases.length}`);
console.log(`Best-match confidence: ${["high", "medium", "low", "none"].map(k => `${k} ${tally[k] ?? 0}`).join(", ")}`);
console.log(`Cases with several lots tied for best: ${caseRows.filter(r => r.bestLots.includes(";")).length}`);
const bands = lotSummary.reduce((a, r) => ((a[r.likelihoodBand] = (a[r.likelihoodBand] ?? 0) + 1), a), {});
console.log(`Lots with possible litigation: ${lotSummary.length} (high ${bands.high ?? 0}, medium ${bands.medium ?? 0}, low ${bands.low ?? 0}); likely cases total ${Math.round(lotSummary.reduce((s, r) => s + r.likelyCases, 0))}`);
console.log(`Wrote ${path.relative(process.cwd(), path.join(opt.out, "case-lots.csv"))}, lot-matches.csv, lot-summary.csv, lot-matches.json`);
