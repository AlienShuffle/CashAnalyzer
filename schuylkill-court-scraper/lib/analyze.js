/**
 * Pure (browser-free) analysis of scraped case records.
 * Everything here is deterministic so it can be unit tested and re-run on saved snapshots.
 */

export const DEFAULT_ORG_PATTERN = /wynonah|\bLWPOA\b/i;

// Lake Wynonah Municipal Authority is the sewer/water utility, a separate entity from the POA.
const MUNICIPAL_AUTHORITY = /municipal\s+auth/i;

const NON_PARTY_ROLES = /attorney|counsel|law firm|garnishee|judge|sheriff/i;
const PLAINTIFF_SIDE = /plaintiff|petitioner|appellant|creditor|claimant|movant/i;
const DEFENDANT_SIDE = /defendant|respondent|appellee|debtor/i;

// Matches "Satisfied"/"Satisfaction" but not "Unsatisfied", "Not Satisfied" or "Non-satisfied".
const SATISFIED = /(?<!\b(?:un|non-?|not\s+))satisf/i;
const RELEASED = /vacat|strick|struck|stricken|discontinu|withdraw|settled|marked\s+paid|released|opened/i;

const DUES_CATEGORY = /contract|debt|collection|assessment|money|transcript|magisterial|district\s+(justice|judge)|\bmdj\b|lien|judgment/i;
const DUES_DOCKET = /\bdues\b|assessment|maintenance\s+fee|annual\s+fee|association\s+fee|unpaid|account\s+stated|collection/i;
const MDJ_TRANSFER = /transcript|magisterial|district\s+(justice|judge)|\bmdj\b/i;
const LIEN_TEXT = /\blien\b/i;
const REVIVAL = /reviv/i;
// Docket entries that end a judgment: "PRAECIPE/SATISFY JUDGMENT", "PRAECIPE/SETTLE AND DISCONTINUE", ...
// Excludes entries that end only a collection step (garnishment, attachment, writ), an attorney's
// appearance, or a pending motion/petition; a bare "PRAECIPE TO WITHDRAW" is too ambiguous to count.
const DOCKET_RELEASED = /^(?!.*(garnish|attachment|appearance|counsel|writ|execution|motion|petition)).*(settle|discontinu|vacat|strike|struck|withdraw\w*\s+(the\s+)?(action|judgment|complaint|case))/i;

export function parseMoney(text) {
  if (text == null) return null;
  const s = String(text).trim();
  const m = s.match(/\(?-?\$?\s*([\d,]+(?:\.\d+)?)\)?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return (s.startsWith("(") && s.includes(")")) || s.startsWith("-") ? -n : n;
}

/** "02/15/2023" (optionally followed by more text) -> "2023-02-15"; returns "" when no date. */
export function toIsoDate(text) {
  const m = String(text ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function isOrg(name, pattern = DEFAULT_ORG_PATTERN) {
  return pattern.test(String(name ?? ""));
}

function sideOf(p) {
  const s = `${p.side ?? ""} ${p.role ?? ""}`;
  if (PLAINTIFF_SIDE.test(s)) return "Plaintiff";
  if (DEFENDANT_SIDE.test(s)) return "Defendant";
  return "";
}

/** Docket "category - description", without repeating the category when the description already starts with it. */
function docketSummary(d) {
  const cat = (d.category || "").trim(), desc = (d.description || "").replace(/\s+/g, " ").trim();
  if (cat && desc.toUpperCase().startsWith(cat.toUpperCase())) return desc;
  return [cat, desc].filter(Boolean).join(" - ");
}

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function judgmentStatus(j, resolution) {
  const d = String(j.description ?? "");
  if (SATISFIED.test(d)) return "Satisfied";
  if (RELEASED.test(d)) return "Released";
  // A later satisfy/settle docket or case disposition resolves judgments entered on or before it.
  if (resolution && (!resolution.dateIso || !j.dateIso || j.dateIso <= resolution.dateIso)) return resolution.status;
  return "Open";
}

/** Latest case-level event that resolves its judgments, from dispositions or docket entries. */
function caseResolution(raw, dockets) {
  const events = [];
  if (SATISFIED.test(raw.dispositionFinal ?? "")) events.push({ status: "Satisfied", dateIso: toIsoDate(raw.dispositionFinal), source: raw.dispositionFinal });
  for (const d of raw.dispositions ?? []) {
    if (SATISFIED.test(d.result)) events.push({ status: "Satisfied", dateIso: toIsoDate(d.date), source: `disposition ${d.result}` });
  }
  for (const d of dockets) {
    const t = `${d.category} ${d.description}`;
    if (SATISFIED.test(t)) events.push({ status: "Satisfied", dateIso: d.dateIso, source: `docket ${d.date} ${d.category}` });
    else if (DOCKET_RELEASED.test(d.category ?? "")) events.push({ status: "Released", dateIso: d.dateIso, source: `docket ${d.date} ${d.category}` });
  }
  return events.sort((a, b) => (b.dateIso || "").localeCompare(a.dateIso || ""))[0] ?? null;
}

/** "date - result" of the dispositions in a category ("Final", "AOPC"). */
function dispositionOf(raw, category) {
  return (raw.dispositions ?? []).filter(d => new RegExp(`^${category}$`, "i").test(d.category ?? ""))
    .map(d => [d.date, d.result].filter(Boolean).join(" - ")).join("; ");
}

const PREFIX_ROLES = { pla: "Plaintiff", def: "Defendant", app: "Appellant", res: "Respondent", pet: "Petitioner", gar: "Garnishee", att: "Attorney" };

/** Participants from the results-row "Pla:/Def:" column, used when the detail page could not be read. */
function participantsFromListRow(listRow) {
  if (!listRow) return [];
  const listed = listRow.listParticipants?.length ? listRow.listParticipants : [
    ...String(listRow.plaintiffs ?? "").split(";").map(name => ({ prefix: "Pla", name })),
    ...String(listRow.defendants ?? "").split(";").map(name => ({ prefix: "Def", name }))
  ];
  return listed.map(p => ({ name: String(p.name ?? "").trim().replace(/,$/, ""), role: PREFIX_ROLES[String(p.prefix).slice(0, 3).toLowerCase()] || p.prefix || "", address: "", fromList: true }))
    .map(p => ({ ...p, side: p.role }))
    .filter(p => p.name);
}

/**
 * Derive the analysis fields for one case.
 * @param {object} raw case record produced by lib/portal.js
 * @param {RegExp} orgPattern matches Lake Wynonah participant names
 */
export function analyzeCase(raw, orgPattern = DEFAULT_ORG_PATTERN) {
  const participants = raw.participants?.length ? raw.participants : participantsFromListRow(raw.listRow);
  const parties = participants.filter(p => !NON_PARTY_ROLES.test(p.role ?? ""));
  const orgParties = parties.filter(p => isOrg(p.name, orgPattern));
  const orgSides = uniq(orgParties.map(sideOf));
  const lwSide = orgSides.length === 1 ? orgSides[0] : "";

  const otherParties = parties.filter(p => !isOrg(p.name, orgPattern));
  const opposing = lwSide ? otherParties.filter(p => sideOf(p) && sideOf(p) !== lwSide) : otherParties;
  const lwAttorneys = participants.filter(p => /attorney/i.test(p.role ?? "") && lwSide && sideOf(p) === lwSide);

  const dockets = (raw.dockets ?? []).map(d => ({ ...d, dateIso: toIsoDate(d.date) }));
  const resolution = caseResolution(raw, dockets);
  const caseSatisfied = resolution?.status === "Satisfied";

  const judgments = (raw.judgments ?? []).map(j => {
    const amountValue = parseMoney(j.amount);
    // The portal often lists the money judgment with blank creditor/debtor; attribute it by LW's side in the case.
    const partiesBlank = !String(j.creditor ?? "").trim() && !String(j.debtor ?? "").trim();
    return {
      ...j,
      dateIso: toIsoDate(j.date),
      amountValue,
      judgmentKind: amountValue > 0 ? "Money judgment" : "Writ/other (no amount)",
      lwIsCreditor: isOrg(j.creditor, orgPattern) || (partiesBlank && lwSide === "Plaintiff"),
      lwIsDebtor: isOrg(j.debtor, orgPattern) || (partiesBlank && lwSide === "Defendant"),
      partiesInferred: partiesBlank && !!lwSide,
      judgmentStatus: judgmentStatus({ ...j, dateIso: toIsoDate(j.date) }, resolution)
    };
  }).map(j => {
    const fromDescription = SATISFIED.test(j.description ?? "") || RELEASED.test(j.description ?? "");
    return { ...j, resolvedBy: j.judgmentStatus !== "Open" && !fromDescription ? resolution.source : "" };
  });

  const sum = (list) => Number(list.reduce((a, j) => a + (j.amountValue ?? 0), 0).toFixed(2));
  const forLw = judgments.filter(j => j.lwIsCreditor);
  const againstLw = judgments.filter(j => j.lwIsDebtor);
  const openForLw = forLw.filter(j => j.judgmentStatus === "Open");
  const openMoneyForLw = openForLw.filter(j => j.amountValue > 0);
  const sortedDockets = [...dockets].sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  const lastDocket = sortedDockets[0];

  const caseText = [raw.caseType, raw.listRow?.caseCategory, raw.commencement].join(" ");
  const docketText = dockets.map(d => `${d.category} ${d.description}`).join(" | ");
  const judgmentText = judgments.map(j => j.description).join(" | ");

  const lwSeeksMoney = lwSide === "Plaintiff" || forLw.length > 0;
  const duesReasons = [];
  if (lwSeeksMoney) {
    if (forLw.length) duesReasons.push("judgment in favor of LW");
    if (DUES_CATEGORY.test(caseText)) duesReasons.push(`case type "${(raw.caseType || raw.listRow?.caseCategory || "").trim()}"`);
    if (DUES_DOCKET.test(docketText) || DUES_DOCKET.test(judgmentText)) duesReasons.push("dues/assessment/collection wording in dockets");
    if (MDJ_TRANSFER.test(caseText) || MDJ_TRANSFER.test(docketText)) duesReasons.push("judgment transferred from magisterial district court");
  }
  const lwEntityNames = uniq([...orgParties.map(p => p.name), ...judgments.flatMap(j => [j.creditor, j.debtor]).filter(n => isOrg(n, orgPattern))]);
  const authorityOnly = lwEntityNames.length > 0 && lwEntityNames.every(n => MUNICIPAL_AUTHORITY.test(n));
  const lwEntity = !lwEntityNames.length ? "" : authorityOnly ? "Municipal Authority"
    : lwEntityNames.some(n => MUNICIPAL_AUTHORITY.test(n)) ? "POA + Municipal Authority" : "POA";

  let duesClass = "";
  if (authorityOnly) {
    duesClass = "no";
    duesReasons.length = 0;
    duesReasons.push("Lake Wynonah Municipal Authority (sewer/water utility), not the POA");
  } else if (lwSeeksMoney) {
    duesClass = duesReasons.some(r => !r.startsWith("judgment in favor")) ? "likely" : "possible";
  }

  const lienReasons = [];
  if (openMoneyForLw.length) lienReasons.push("unsatisfied money judgment in favor of LW (judgment lien on debtor real estate in county)");
  if (openForLw.some(j => REVIVAL.test(j.description)) || (lwSide === "Plaintiff" && REVIVAL.test(caseText) && !resolution)) {
    lienReasons.push("writ of revival by LW (revives/continues an existing judgment lien)");
  }
  if (LIEN_TEXT.test(caseText) || LIEN_TEXT.test(docketText)) lienReasons.push("lien wording in case type/dockets");

  let caseKind = "LW not identified";
  if (orgParties.length || forLw.length || againstLw.length) {
    if (lwSide === "Plaintiff" || (forLw.length && !againstLw.length)) caseKind = "LW plaintiff/creditor";
    else if (lwSide === "Defendant" || againstLw.length) caseKind = "LW defendant/debtor";
    else caseKind = "LW other role";
  }

  let caseJudgmentStatus = "None";
  if (judgments.length) {
    const money = judgments.filter(j => j.amountValue > 0);
    const statuses = uniq((money.length ? money : judgments).map(j => j.judgmentStatus));
    caseJudgmentStatus = statuses.length === 1 ? statuses[0] : "Mixed";
  }

  const namesBySide = (side) => uniq(parties.filter(p => sideOf(p) === side).map(p => p.name)).join("; ");

  return {
    ...raw,
    participants,
    judgments,
    dockets,
    openedDate: raw.dateFiled || raw.listRow?.opened || "",
    openedDateIso: toIsoDate(raw.dateFiled || raw.listRow?.opened),
    closedDateIso: toIsoDate(raw.dateClosed),
    caseKind,
    lwRole: lwSide || uniq(orgParties.map(p => p.role)).join("; "),
    lwNames: uniq(orgParties.map(p => p.name)).join("; "),
    lwEntity,
    lwAttorneys: uniq(lwAttorneys.map(p => p.name)).join("; "),
    plaintiffs: namesBySide("Plaintiff") || raw.listRow?.plaintiffs || "",
    defendants: namesBySide("Defendant") || raw.listRow?.defendants || "",
    opposingParties: uniq(opposing.map(p => p.name)).join("; "),
    opposingAddresses: uniq(opposing.map(p => p.address)).join("; "),
    judgmentCount: judgments.length,
    judgmentAmounts: judgments.map(j => j.amount).filter(Boolean).join(" | "),
    judgmentTotal: sum(judgments),
    judgmentTotalForLW: sum(forLw),
    judgmentOpenForLW: sum(openForLw),
    judgmentTotalAgainstLW: sum(againstLw),
    judgmentStatus: caseJudgmentStatus,
    latestJudgmentDate: judgments.map(j => j.dateIso).sort().at(-1) ?? "",
    caseSatisfied,
    dispositionFinal: raw.dispositionFinal || dispositionOf(raw, "Final"),
    dispositionAopc: raw.dispositionAopc || dispositionOf(raw, "AOPC"),
    judgmentResolution: resolution && judgments.some(j => j.resolvedBy) ? `${resolution.status}: ${resolution.source}` : "",
    duesClass,
    duesReasons: duesReasons.join("; "),
    lienIndicator: lienReasons.length > 0,
    lienReasons: lienReasons.join("; "),
    docketCount: dockets.length,
    lastDocketDate: lastDocket?.dateIso ?? "",
    lastDocketEntry: lastDocket ? docketSummary(lastDocket) : ""
  };
}

/** One row per case. Extend here to add columns to cases.csv. */
export const CASE_COLUMNS = [
  "caseNumber",
  "caption",
  "status",
  "openedDate",
  "dateClosed",
  "daysOpen",
  "caseCategory",
  "caseKind",
  "lwEntity",
  "lwRole",
  "lwNames",
  "opposingParties",
  "opposingAddresses",
  "plaintiffs",
  "defendants",
  "lwAttorneys",
  "dispositionFinal",
  "dispositionAopc",
  "judgmentCount",
  "judgmentAmounts",
  "judgmentTotal",
  "judgmentTotalForLW",
  "judgmentOpenForLW",
  "judgmentTotalAgainstLW",
  "judgmentStatus",
  "judgmentResolution",
  "latestJudgmentDate",
  "duesClass",
  "duesReasons",
  "lienIndicator",
  "lienReasons",
  "docketCount",
  "lastDocketDate",
  "lastDocketEntry",
  "referenceNumbers",
  "commencement",
  "notes",
  "firstSeen",
  "lastSeen",
  "statusHistory",
  "detailUrl",
  "scrapeError",
  "carriedForwardFrom"
];

export const JUDGMENT_COLUMNS = ["caseNumber", "caption", "date", "creditor", "debtor", "description", "amount", "amountValue", "judgmentKind", "judgmentStatus", "resolvedBy", "lwIsCreditor", "lwIsDebtor", "partiesInferred"];
export const DOCKET_COLUMNS = ["caseNumber", "date", "category", "description", "attachments"];
export const PARTICIPANT_COLUMNS = ["caseNumber", "side", "role", "name", "address", "isLW"];

export function caseCsvRow(c) {
  return {
    ...c,
    caseCategory: c.caseType || c.listRow?.caseCategory || "",
    statusHistory: (c.statusHistory ?? []).map(h => `${h.date}:${h.status}`).join(" > ")
  };
}

export function toCSV(rows, cols) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n") + "\n";
}
