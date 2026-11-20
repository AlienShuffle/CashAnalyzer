/**
 * Match court-case defendants to Lake Wynonah lots (pure, browser-free).
 * Signals: defendant address = lot location, defendant address = owner mailing address,
 * and defendant name = lot owner during the period the case was filed.
 */

const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "ETAL", "ETUX", "ETVIR", "ESQ", "MR", "MRS", "MS", "EST", "ESTATE", "DECEASED", "DEC"]);
const ORG = /\b(INC|LLC|L L C|CORP|CORPORATION|COMPANY|CO|TRUST|TRUSTEE|BANK|CREDIT UNION|FCU|SAVINGS|MORTGAGE|HUD|SECRETARY|FEDERAL|NA|LP|LTD|ASSOCIATION|ASSN|AUTHORITY|COMMONWEALTH|COUNTY|TOWNSHIP|HOMES|PARTNERS|PARTNERSHIP|ENTERPRISES|PROPERTIES|HOLDINGS)\b/;
// Garnishees and lenders listed as defendants must not match bank-owned (foreclosure) periods.
const FINANCIAL = /\b(BANK|CREDIT UNION|FCU|SAVINGS|MORTGAGE|HUD|SECRETARY|FEDERAL|FINANCIAL|LENDING|LOAN)\b/;
const ORG_NOISE = new Set(["INC", "LLC", "L", "C", "CORP", "CORPORATION", "CO", "COMPANY", "A", "THE", "OF", "NA", "LP", "LTD"]);

const STREET_SUFFIX = {
  DRIVE: "DR", DR: "DR", COVE: "CV", CV: "CV", STREET: "ST", ST: "ST", ROAD: "RD", RD: "RD", AVENUE: "AVE", AVE: "AVE", AV: "AVE",
  LANE: "LN", LN: "LN", COURT: "CT", CT: "CT", BOULEVARD: "BLVD", BLVD: "BLVD", PLACE: "PL", PL: "PL", CIRCLE: "CIR", CIR: "CIR",
  TERRACE: "TER", TER: "TER", WAY: "WAY", HIGHWAY: "HWY", HWY: "HWY", PIKE: "PIKE", TRAIL: "TRL", TRL: "TRL"
};
const DIRECTION = { NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W", N: "N", S: "S", E: "E", W: "W" };
const UNIT = /\b(APT|APARTMENT|UNIT|STE|SUITE|LOT|#)\s*\S+/g;

const words = (s) => String(s ?? "").toUpperCase().replace(/['’`]/g, "").replace(/[^A-Z0-9&,#\s-]/g, " ").replace(/-/g, " ").split(/\s+/).filter(Boolean);

export function isOrgName(name) {
  return ORG.test(words(name).join(" "));
}

function orgKey(name) {
  return words(name).filter(w => !ORG_NOISE.has(w) && w !== "&" && w !== ",").join("").replace(/,/g, "");
}

/** Parse a lot-owner string: "LAST, FIRST M", "MOYER, M L & C D", "HEFFNER JR W J & D L". */
export function parseOwnerName(name) {
  const raw = String(name ?? "").toUpperCase();
  if (!raw.trim()) return null;
  if (isOrgName(raw)) return { org: true, key: orgKey(raw), display: raw.trim() };
  const key = orgKey(raw);
  const clean = (part) => words(part).map(w => w.replace(/,/g, "")).filter(w => w && !SUFFIXES.has(w));
  let surnameTokens, givenPart;
  if (raw.includes(",")) {
    const i = raw.indexOf(",");
    surnameTokens = clean(raw.slice(0, i));
    givenPart = raw.slice(i + 1);
  } else {
    const toks = clean(raw.replace(/&/g, " & "));
    surnameTokens = toks.slice(0, 1);
    givenPart = raw.split(/\s+/).slice(1).join(" ");
  }
  if (!surnameTokens.length) return null;
  const givenSets = givenPart.split("&").map(clean).filter(g => g.length);
  return { org: false, key, surname: surnameTokens.join(""), surnameTokens, givenSets, display: raw.trim() };
}

/**
 * Parse a case participant name. The portal mostly uses "FIRST M LAST, JR"; the results list uses
 * "LAST JR, FIRST M". Returns the plausible (surname, given) readings.
 */
export function parseCaseName(name) {
  const raw = String(name ?? "").toUpperCase().trim();
  if (!raw) return null;
  if (isOrgName(raw)) return { org: true, financial: FINANCIAL.test(words(raw).join(" ")), key: orgKey(raw), display: raw };
  const clean = (part) => words(part).map(w => w.replace(/,/g, "")).filter(w => w && w !== "&" && !SUFFIXES.has(w));
  const readings = [];
  const i = raw.indexOf(",");
  // The first reading is the most likely one; the others only count with a first-name/initial match.
  if (i > 0 && clean(raw.slice(i + 1)).length) {
    readings.push({ surname: clean(raw.slice(0, i)).join(""), given: clean(raw.slice(i + 1)) });
  }
  const toks = clean(raw);
  if (toks.length >= 2) {
    readings.push({ surname: toks.at(-1), given: toks.slice(0, -1) });
    readings.push({ surname: toks[0], given: toks.slice(1) });
    // Two-word surnames: "TRACY VANDER MUELEN" -> VANDERMUELEN.
    if (toks.length >= 3) readings.push({ surname: toks.slice(-2).join(""), given: toks.slice(0, -2) });
  }
  const seen = new Set();
  return { org: false, display: raw, readings: readings.filter(r => r.surname && !seen.has(r.surname + r.given) && seen.add(r.surname + r.given)) };
}

/** "full" (first name matches), "initial", "surname", or "" when surnames differ. */
export function nameMatch(caseName, ownerName) {
  if (!caseName || !ownerName) return "";
  if (caseName.org) {
    // Owner names can be truncated in the lot data, so a long common prefix counts.
    const a = caseName.key, b = ownerName.key ?? "";
    const prefix = Math.min(a.length, b.length) >= 12 && (a.startsWith(b) || b.startsWith(a));
    return !caseName.financial && a && (a === b || prefix) ? "full" : "";
  }
  if (ownerName.org) return "";
  let best = "";
  const rank = { "": 0, surname: 1, initial: 2, full: 3 };
  for (const [ri, r] of caseName.readings.entries()) {
    if (r.surname !== ownerName.surname && !(ownerName.surnameTokens.length > 1 && ownerName.surnameTokens.includes(r.surname))) continue;
    let level = "surname";
    for (const g of ownerName.givenSets) {
      const fullHit = g.some(t => t.length > 1 && r.given.some(c => c.length > 1 && c === t));
      if (fullHit) { level = "full"; break; }
      if (r.given[0] && g[0] && r.given[0][0] === g[0][0]) level = "initial";
    }
    if (level === "surname" && ri > 0) continue;
    if (rank[level] > rank[best]) best = level;
  }
  return best;
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

function snapshotRange(snaps) {
  const current = snaps.has("current");
  const dates = [...snaps].filter(x => x !== "current").sort();
  const span = dates.length ? (dates.length === 1 ? dates[0] : `${dates[0]}…${dates.at(-1)}`) : "";
  return [current && "current", span && `snapshots ${span}`].filter(Boolean).join("; ");
}

/** Parse "762 CHEYENNE DRIVE, AUBURN, PA 17922" or "123 HOGAN DR\nAUBURN PA 179229501". */
export function parseAddress(text) {
  const s = String(text ?? "").toUpperCase();
  if (!s.trim()) return null;
  const parts = s.split(/\n|,/).map(p => p.trim()).filter(Boolean);
  const zip = (s.match(/\b(\d{5})(?:-?\d{4})?\s*$/) || s.match(/\b(\d{5})(?:-?\d{4})?\b(?!.*\b\d{5}\b)/s) || [])[1] || "";
  const city = /\bAUBURN\b/.test(s) ? "AUBURN" : "";
  // Skip "C/O ..." / "ATTN ..." lines: use the first part that looks like a street or PO box.
  const line = parts.find(p => /^(\d|P\.?\s*O\.?\s*BOX|BOX\s)/.test(p)) || parts[0] || "";
  const po = line.replace(/\./g, "").match(/^P\s*O\s*BOX\s+(\w+)/) || line.replace(/\./g, "").match(/^BOX\s+(\w+)/);
  if (po) return { poBox: po[1], zip, city, key: `POBOX|${po[1]}|${zip}` };
  const toks = words(line.replace(UNIT, " ")).map(w => w.replace(/[,#]/g, "")).filter(Boolean);
  if (!toks.length || !/^\d+[A-Z]?$/.test(toks[0])) return { zip, city, street: "", num: "" };
  const num = toks[0];
  let rest = toks.slice(1).map(w => DIRECTION[w] && toks.length > 3 ? DIRECTION[w] : w);
  let suffix = "";
  if (rest.length > 1 && STREET_SUFFIX[rest.at(-1)]) { suffix = STREET_SUFFIX[rest.at(-1)]; rest = rest.slice(0, -1); }
  const street = rest.join("");
  return { num, street, suffix, zip, city, key: `${num}|${street}|${suffix}` };
}

/** Compare a defendant address with a lot location: "exact", "street" (suffix differs or 1-letter typo), or "". */
export function addressMatch(a, b) {
  if (!a || !b || !a.num || !b.num || a.num !== b.num || !a.street || !b.street) return "";
  const sameStreet = a.street === b.street || (a.street.length >= 5 && levenshtein(a.street, b.street) <= 1);
  if (!sameStreet) return "";
  return a.street === b.street && a.suffix === b.suffix ? "exact" : "street";
}

/** Ownership periods of a lot, newest first: [{owners, from, to}] (to = next sale date, "" = current). */
export function ownershipPeriods(lot) {
  const entries = [{ owners: lot.owners ?? [], from: lot.saleDate ?? "" }, ...(lot.previousOwners ?? []).map(p => ({ owners: p.owners ?? [], from: p.saleDate ?? "" }))]
    .sort((a, b) => (b.from || "").localeCompare(a.from || ""));
  return entries.map((e, i) => ({ owners: [...new Set(e.owners)], from: e.from, to: i === 0 ? "" : entries[i - 1].from, current: i === 0 }));
}

function shiftYears(iso, years) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

/** How a period relates to a filing date: "at filing", "before filing" (sold within 3y before), or "other". */
export function periodTiming(period, filedIso) {
  if (!filedIso) return "at filing";
  const startedBefore = !period.from || period.from <= filedIso;
  if (startedBefore && (!period.to || period.to > filedIso)) return "at filing";
  if (startedBefore && period.to >= shiftYears(filedIso, -3)) return "before filing";
  return "other";
}

const NAME_POINTS = { full: 55, initial: 35, surname: 15 };
const TIMING_FACTOR = { "at filing": 1, "before filing": 0.9, other: 0.4 };

/**
 * Build the lot index once.
 * @param {object[]} lots records from lwlots/4-lot-normalized.json
 * @param {{lot:number, address:string, snapshot:string}[]} mailingHistory extra mailing addresses from older lot snapshots
 */
export function buildLotIndex(lots, mailingHistory = []) {
  const byLot = new Map();
  const bySurname = new Map();
  const orgOwners = [];
  const byStreetNum = new Map();
  const byMailing = new Map();
  const surnameLots = new Map();

  for (const lot of lots) {
    const periods = ownershipPeriods(lot).map(p => ({ ...p, parsed: p.owners.map(parseOwnerName).filter(Boolean) }));
    const location = parseAddress(`${lot.location}, AUBURN PA 17922`);
    byLot.set(lot.lot, { lot, periods, location });
    if (location?.num) {
      const k = location.num;
      if (!byStreetNum.has(k)) byStreetNum.set(k, []);
      byStreetNum.get(k).push(lot.lot);
    }
    periods.forEach((p, pi) => p.parsed.forEach(o => {
      if (o.org || o.key?.length >= 12) orgOwners.push({ lot: lot.lot, pi, owner: o });
      if (o.org) return;
      if (!bySurname.has(o.surname)) bySurname.set(o.surname, []);
      bySurname.get(o.surname).push({ lot: lot.lot, pi, owner: o });
      if (!surnameLots.has(o.surname)) surnameLots.set(o.surname, new Set());
      surnameLots.get(o.surname).add(lot.lot);
      for (const t of o.surnameTokens) if (t !== o.surname) {
        if (!bySurname.has(t)) bySurname.set(t, []);
        bySurname.get(t).push({ lot: lot.lot, pi, owner: o });
      }
    }));
    for (const m of [{ address: lot.address, snapshot: "current" }]) addMailing(byMailing, lot.lot, m);
  }
  for (const m of mailingHistory) if (byLot.has(m.lot)) addMailing(byMailing, m.lot, m);
  return { byLot, bySurname, orgOwners, byStreetNum, byMailing, surnameLots };
}

function addMailing(byMailing, lotNo, { address, snapshot }) {
  const a = parseAddress(address);
  if (!a?.key || (!a.num && !a.poBox)) return;
  const key = a.poBox ? a.key : `${a.num}|${a.street}|${a.zip}`;
  if (!byMailing.has(key)) byMailing.set(key, new Map());
  const lots = byMailing.get(key);
  if (!lots.has(lotNo)) lots.set(lotNo, { address: String(address).replace(/\n/g, ", "), snapshots: new Set() });
  lots.get(lotNo).snapshots.add(snapshot);
}

/**
 * Candidate lots for one case.
 * @param {{caseNumber:string, filedIso:string, defendants:{name:string, address:string}[]}} c
 */
export function matchCaseToLots(c, index, { minScore = 25 } = {}) {
  const cands = new Map();
  const cand = (lotNo) => {
    if (!cands.has(lotNo)) cands.set(lotNo, { lot: lotNo, addr: 0, mail: 0, name: 0, reasons: [], matchedOwners: [], defendantsMatched: new Set(), periods: new Set() });
    return cands.get(lotNo);
  };

  for (const d of c.defendants) {
    const addr = parseAddress(d.address);
    // 1) Defendant address is the lot's location.
    // Outside Auburn an exact street match is likely a docket typo or coincidence: a 5-point tie-breaker only.
    const local = !addr?.zip || addr.zip === "17922" || addr.city === "AUBURN";
    if (addr?.num) {
      for (const lotNo of index.byStreetNum.get(addr.num) ?? []) {
        const level = addressMatch(addr, index.byLot.get(lotNo).location);
        if (!level || (!local && level !== "exact")) continue;
        const x = cand(lotNo);
        if (!local) {
          x.addr = Math.max(x.addr, 5);
          x.reasons.push(`${d.name} street address = lot location (different city/zip)`);
          continue;
        }
        const pts = level === "exact" ? 50 : 40;
        if (pts > x.addr) x.addr = pts;
        x.reasons.push(`${d.name} address = lot location${level === "exact" ? "" : " (street spelling/suffix differs)"}`);
        x.defendantsMatched.add(d.name);
      }
    }
    // 2) Defendant address is the owner's mailing address (catches non-Auburn owners).
    if (addr && (addr.num || addr.poBox)) {
      const key = addr.poBox ? addr.key : `${addr.num}|${addr.street}|${addr.zip}`;
      for (const [lotNo, m] of index.byMailing.get(key) ?? []) {
        const x = cand(lotNo);
        x.mail = 40;
        x.reasons.push(`${d.name} address = owner mailing address (${snapshotRange(m.snapshots)})`);
        x.defendantsMatched.add(d.name);
      }
    }
    // 3) Defendant name = an owner of the lot.
    const cn = parseCaseName(d.name);
    if (!cn) continue;
    const pool = cn.org ? index.orgOwners : [...new Set(cn.readings.flatMap(r => index.bySurname.get(r.surname) ?? []))];
    for (const { lot: lotNo, pi, owner } of pool) {
      const level = nameMatch(cn, owner);
      if (!level) continue;
      const period = index.byLot.get(lotNo).periods[pi];
      const timing = periodTiming(period, c.filedIso);
      let pts = NAME_POINTS[level];
      // Surname-only matches are useful only for uncommon surnames.
      if (level === "surname") pts = (index.surnameLots.get(owner.surname)?.size ?? 99) <= 3 ? 25 : 10;
      pts = Math.round(pts * TIMING_FACTOR[timing]);
      const x = cand(lotNo);
      if (pts > x.name) x.name = pts;
      x.reasons.push(`${d.name} ~ owner ${owner.display} (${level} name, ${timing}; owned ${period.from || "?"}–${period.to || "now"})`);
      x.matchedOwners.push({ defendant: d.name, owner: owner.display, level, timing, from: period.from, to: period.to, current: period.current });
      x.defendantsMatched.add(d.name);
      x.periods.add(pi);
    }
  }

  const out = [];
  for (const x of cands.values()) {
    // Two defendants (e.g. spouses) both named as owners in the same period is strong evidence.
    const strongDefs = new Set(x.matchedOwners.filter(m => m.level !== "surname" && m.timing !== "other").map(m => m.defendant));
    const multi = strongDefs.size > 1 ? 25 : x.defendantsMatched.size > 1 ? 10 : 0;
    const score = Math.min(100, x.addr + x.mail + x.name + multi);
    if (score < minScore) continue;
    const { lot, periods } = index.byLot.get(x.lot);
    const strongOwner = x.matchedOwners.filter(m => m.level !== "surname" && m.timing !== "other");
    out.push({
      lot: x.lot,
      parcel: lot.parcel,
      location: lot.location,
      mailingAddress: String(lot.address ?? "").replace(/\n/g, ", "),
      currentOwners: periods[0]?.owners.join("; ") ?? "",
      score,
      confidence: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
      reasons: [...new Set(x.reasons)].join("; "),
      matchedOwners: [...new Set(x.matchedOwners.map(m => `${m.owner} (${m.from || "?"}–${m.to || "now"})`))].join("; "),
      defendantStillOwns: strongOwner.length ? strongOwner.some(m => m.current) : ""
    });
  }
  return out.sort((a, b) => b.score - a.score || a.lot - b.lot);
}

/** Discount for a lot that matched a case but scored below the case's best lot. */
export const ALTERNATIVE_FACTOR = 0.5;

/**
 * Roll case→lot candidates up to one row per lot.
 * Each candidate gives a per-case probability p = score/100 (×ALTERNATIVE_FACTOR when another lot
 * fits the case better). Tied best lots each get full weight: one owner's several lots are usually
 * all covered by the dues judgment.
 * litigationLikelihood = 1 − Π(1 − p) (chance at least one case involves the lot); likelyCases = Σ p.
 * @param {{caseNumber:string, filedYear?:string, lot:string, parcel?:string, location?:string, score:number,
 *   isBest:boolean, confidence:string, defendants?:string, currentOwners?:string, judgmentOpenForLW?:number}[]} rows
 */
export function summarizeByLot(rows) {
  const byLot = new Map();
  for (const r of rows) {
    if (!byLot.has(r.lot)) byLot.set(r.lot, { lot: r.lot, parcel: r.parcel, location: r.location, currentOwners: r.currentOwners, cases: [] });
    const p = Math.min(1, r.score / 100) * (r.isBest ? 1 : ALTERNATIVE_FACTOR);
    byLot.get(r.lot).cases.push({ ...r, p });
  }
  const out = [];
  for (const l of byLot.values()) {
    const best = l.cases.filter(c => c.isBest);
    const likelihood = 1 - l.cases.reduce((q, c) => q * (1 - c.p), 1);
    const years = l.cases.map(c => c.filedYear).filter(Boolean).sort();
    const count = (conf) => best.filter(c => c.confidence === conf).length;
    out.push({
      lot: l.lot, parcel: l.parcel, location: l.location, currentOwners: l.currentOwners,
      litigationLikelihood: Math.round(likelihood * 100),
      likelihoodBand: likelihood >= 0.8 ? "high" : likelihood >= 0.5 ? "medium" : "low",
      likelyCases: Math.round(l.cases.reduce((s, c) => s + c.p, 0) * 10) / 10,
      casesHigh: count("high"), casesMedium: count("medium"), casesLow: count("low"),
      alternativeCases: l.cases.length - best.length,
      openJudgmentCases: l.cases.filter(c => c.p >= 0.5 && Number(c.judgmentOpenForLW) > 0).length,
      firstFiled: years[0] ?? "", lastFiled: years.at(-1) ?? "",
      cases: l.cases.sort((a, b) => b.p - a.p).map(c => `${c.caseNumber} (${Math.round(c.p * 100)}%${c.isBest ? "" : " alt"})`).join("; "),
      defendants: [...new Set(l.cases.flatMap(c => String(c.defendants ?? "").split("; ")).filter(Boolean))].join("; ")
    });
  }
  return out.sort((a, b) => b.litigationLikelihood - a.litigationLikelihood || b.likelyCases - a.likelyCases || Number(a.lot) - Number(b.lot));
}
