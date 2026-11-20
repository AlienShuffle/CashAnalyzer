import fs from "fs";
import path from "path";

/**
 * Historical tracking:
 *  - history/snapshots/cases-YYYY-MM-DD.json  full analyzed case list for each run date
 *  - history/case-ledger.json                 per-case firstSeen / lastSeen / status history
 *  - changes between the new run and the most recent earlier snapshot
 */

const judgmentKey = (j) => [j.date, j.creditor, j.debtor, j.amount].join("|");
const docketKey = (d) => [d.date, d.category, d.description].join("|");

export function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

/** Most recent snapshot file strictly before runDate (YYYY-MM-DD), or null. */
export function findPreviousSnapshot(snapshotDir, runDate) {
  if (!fs.existsSync(snapshotDir)) return null;
  const files = fs.readdirSync(snapshotDir)
    .filter(f => /^cases-\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(6, 16) < runDate)
    .sort();
  return files.length ? path.join(snapshotDir, files.at(-1)) : null;
}

/**
 * Update ledger in place for this run and annotate each case with firstSeen/lastSeen/statusHistory.
 * A new statusHistory entry is added whenever case status, judgment status or final disposition changes.
 */
export function updateLedger(ledger, cases, runDate) {
  ledger.cases ??= {};
  for (const c of cases) {
    const entry = ledger.cases[c.caseNumber] ??= { firstSeen: runDate, statusHistory: [] };
    entry.lastSeen = runDate;
    entry.caption = c.caption;
    const state = { status: c.status || "", judgmentStatus: c.judgmentStatus || "", disposition: c.dispositionFinal || "" };
    const prev = entry.statusHistory.at(-1);
    if (!prev || prev.status !== state.status || prev.judgmentStatus !== state.judgmentStatus || prev.disposition !== state.disposition) {
      entry.statusHistory.push({ date: runDate, ...state });
    }
    c.firstSeen = entry.firstSeen;
    c.lastSeen = entry.lastSeen;
    c.statusHistory = entry.statusHistory;
  }
  ledger.updatedAt = runDate;
  return ledger;
}

/** Compare two analyzed case lists; returns a flat list of change records. */
export function diffCases(prevCases, currCases) {
  const changes = [];
  const prevBy = new Map(prevCases.map(c => [c.caseNumber, c]));
  const currBy = new Map(currCases.map(c => [c.caseNumber, c]));

  for (const [num, curr] of currBy) {
    const prev = prevBy.get(num);
    if (!prev) {
      changes.push({ type: "new-case", caseNumber: num, detail: `${curr.caption} (${curr.status}; ${curr.caseKind})` });
      continue;
    }
    for (const field of ["status", "dispositionFinal", "judgmentStatus"]) {
      if ((prev[field] ?? "") !== (curr[field] ?? "")) {
        changes.push({ type: `${field}-changed`, caseNumber: num, detail: `${prev[field] || "(blank)"} -> ${curr[field] || "(blank)"}` });
      }
    }

    const prevJ = new Map((prev.judgments ?? []).map(j => [judgmentKey(j), j]));
    for (const j of curr.judgments ?? []) {
      const pj = prevJ.get(judgmentKey(j));
      if (!pj) {
        changes.push({ type: "new-judgment", caseNumber: num, detail: `${j.date} ${j.creditor} v ${j.debtor} ${j.amount}` });
      } else if (pj.judgmentStatus !== j.judgmentStatus) {
        changes.push({ type: "judgment-status-changed", caseNumber: num, detail: `${j.date} ${j.amount}: ${pj.judgmentStatus} -> ${j.judgmentStatus}` });
      }
    }

    const prevD = new Set((prev.dockets ?? []).map(docketKey));
    const newDockets = (curr.dockets ?? []).filter(d => !prevD.has(docketKey(d)));
    for (const d of newDockets) {
      changes.push({ type: "new-docket", caseNumber: num, detail: `${d.date} ${d.category}${d.description && d.description !== d.category ? " - " + d.description : ""}` });
    }
  }

  for (const [num, prev] of prevBy) {
    if (!currBy.has(num)) changes.push({ type: "missing-case", caseNumber: num, detail: `${prev.caption} no longer returned by search` });
  }
  return changes;
}
