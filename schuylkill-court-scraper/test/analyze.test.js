import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCase, parseMoney, toIsoDate, toCSV } from "../lib/analyze.js";
import { diffCases, updateLedger } from "../lib/history.js";

const duesCase = {
  caseNumber: "2019-NO-000123",
  caption: "Lake Wynonah Property Owners Association vs. John Smith",
  caseType: "Judgment: Transcript from District Justice",
  status: "Closed",
  dateFiled: "03/04/2019",
  dispositionFinal: "",
  participants: [
    { side: "Plaintiff", role: "Plaintiff", name: "LAKE WYNONAH PROPERTY OWNERS ASSOCIATION INC", address: "PO Box 1, Auburn, PA" },
    { side: "Plaintiff", role: "Attorney", name: "Jane Lawyer", address: "" },
    { side: "Defendant", role: "Defendant", name: "SMITH, JOHN", address: "12 Lake Dr, Auburn, PA" },
    { side: "Defendant", role: "Defendant", name: "SMITH, MARY", address: "12 Lake Dr, Auburn, PA" }
  ],
  dockets: [
    { date: "03/04/2019", category: "TRANSCRIPT", description: "TRANSCRIPT OF JUDGMENT FROM MDJ 21-3-02" },
    { date: "06/01/2020", category: "PRAECIPE", description: "PRAECIPE FOR WRIT OF EXECUTION" }
  ],
  judgments: [
    { date: "03/04/2019", creditor: "Lake Wynonah Property Owners Association", debtor: "John Smith", description: "", amount: "$1,234.50" },
    { date: "03/04/2019", creditor: "Lake Wynonah Property Owners Association", debtor: "Mary Smith", description: "Satisfied 07/01/2021", amount: "$100.00" }
  ]
};

test("parseMoney and toIsoDate handle portal formats", () => {
  assert.equal(parseMoney("$5,432.10"), 5432.1);
  assert.equal(parseMoney("($100.00)"), -100);
  assert.equal(parseMoney(""), null);
  assert.equal(toIsoDate("10/27/2020 884 Days"), "2020-10-27");
  assert.equal(toIsoDate(""), "");
});

test("dues-collection case: LW plaintiff, judgments, lien, opposing parties", () => {
  const c = analyzeCase(duesCase);
  assert.equal(c.caseKind, "LW plaintiff/creditor");
  assert.equal(c.lwRole, "Plaintiff");
  assert.equal(c.opposingParties, "SMITH, JOHN; SMITH, MARY");
  assert.equal(c.lwAttorneys, "Jane Lawyer");
  assert.equal(c.judgmentTotalForLW, 1334.5);
  assert.equal(c.judgmentOpenForLW, 1234.5);
  assert.equal(c.judgmentStatus, "Mixed");
  assert.equal(c.duesClass, "likely");
  assert.match(c.duesReasons, /magisterial/);
  assert.equal(c.lienIndicator, true);
  assert.equal(c.lastDocketDate, "2020-06-01");
});

test("satisfied case disposition marks all judgments satisfied", () => {
  const c = analyzeCase({ ...duesCase, dispositionFinal: "03/30/2023 - S - Satisfied" });
  assert.equal(c.judgmentStatus, "Satisfied");
  assert.equal(c.judgmentOpenForLW, 0);
  assert.equal(c.lienIndicator, false);
});

test("'Unsatisfied' / 'Not Satisfied' wording does not mark judgments satisfied", () => {
  for (const dispositionFinal of ["Judgment Unsatisfied", "Not Satisfied", "Non-satisfied"]) {
    const c = analyzeCase({ ...duesCase, dispositionFinal, judgments: [{ ...duesCase.judgments[0], description: dispositionFinal }] });
    assert.equal(c.judgmentStatus, "Open", dispositionFinal);
    assert.equal(c.lienIndicator, true, dispositionFinal);
  }
});

test("live-portal patterns: blank-party money judgment, $0 writs, docket satisfaction", () => {
  const live = {
    ...duesCase,
    judgments: [
      { date: "07/17/2023", creditor: "", debtor: "", description: "JUDGMENT ENTERED-NOTICES SENT", amount: "$3,116.71" },
      { date: "06/24/2024", creditor: "LAKE WYNONAH PROPERTY OWNERS ASSOCIATION", debtor: "SMITH, JOHN", description: "WRIT OF EXECUTION", amount: "$0.00" }
    ],
    dockets: [
      { date: "07/17/2023", category: "JUDGMENT", description: "JUDGMENT" },
      { date: "07/12/2024", category: "PRAECIPE TO DISCONTINUE AGAINST GARNISHEE", description: "" },
      { date: "08/01/2024", category: "PRAECIPE/WITHDRAW APPEARANCE OF COUNSEL", description: "" },
      { date: "08/02/2024", category: "PRAECIPE TO WITHDRAW WRIT OF EXECUTION", description: "" },
      { date: "08/03/2024", category: "PRAECIPE/DISCONTINUE ATTACHMENT", description: "" },
      { date: "08/04/2024", category: "PRAECIPE TO WITHDRAW", description: "" }
    ]
  };
  const open = analyzeCase(live);
  assert.equal(open.judgments[0].lwIsCreditor, true);
  assert.equal(open.judgments[0].partiesInferred, true);
  assert.equal(open.judgments[1].judgmentKind, "Writ/other (no amount)");
  assert.equal(open.judgmentOpenForLW, 3116.71);
  assert.equal(open.judgmentStatus, "Open");
  assert.equal(open.lienIndicator, true);

  const satisfied = analyzeCase({ ...live, dockets: [...live.dockets, { date: "12/09/2025", category: "PRAECIPE/SATISFY JUDGMENT", description: "" }] });
  assert.equal(satisfied.judgmentStatus, "Satisfied");
  assert.equal(satisfied.judgmentOpenForLW, 0);
  assert.equal(satisfied.lienIndicator, false);
  assert.match(satisfied.judgmentResolution, /12\/09\/2025 PRAECIPE\/SATISFY JUDGMENT/);

  const settled = analyzeCase({ ...live, dockets: [...live.dockets, { date: "07/07/2025", category: "PRAECIPE/SETTLE AND DISCONTINUE", description: "" }] });
  assert.equal(settled.judgmentStatus, "Released");

  // A satisfaction dated before the judgment does not resolve it.
  const earlier = analyzeCase({ ...live, dockets: [{ date: "05/05/2021", category: "SATISFACTION", description: "" }] });
  assert.equal(earlier.judgmentStatus, "Open");
  assert.equal(earlier.judgmentResolution, "");
});

test("dispositions table fills dispositionFinal/AOPC", () => {
  const c = analyzeCase({ ...duesCase, dispositions: [
    { date: "01/02/2025", category: "Final", result: "Closed" },
    { date: "01/02/2025", category: "AOPC", result: "G - Dismissed/Discontinued" }
  ] });
  assert.equal(c.dispositionFinal, "01/02/2025 - Closed");
  assert.equal(c.dispositionAopc, "01/02/2025 - G - Dismissed/Discontinued");
});

test("Lake Wynonah Municipal Authority cases are not dues collection", () => {
  const authority = (name) => ({
    ...duesCase,
    caseType: "Certified Commonwealth, Municipal, Suggestion Non-Payment, Lis Pendens",
    participants: [{ side: "Plaintiff", role: "Plaintiff", name, address: "" }, duesCase.participants[2]],
    judgments: [{ date: "03/04/2019", creditor: name, debtor: "SMITH, JOHN", description: "", amount: "$250.00" }]
  });
  const c = analyzeCase(authority("LAKE WYNONAH MUNICIPAL AUTH."));
  assert.equal(c.lwEntity, "Municipal Authority");
  assert.equal(c.duesClass, "no");
  assert.match(c.duesReasons, /utility/);
  assert.equal(analyzeCase(duesCase).lwEntity, "POA");
});

test("LW as defendant is not classified as dues collection", () => {
  const c = analyzeCase({
    caseNumber: "2022-SU-000001", caseType: "Civil: Tort - Premises Liability",
    participants: [
      { side: "Plaintiff", role: "Plaintiff", name: "DOE, JANE" },
      { side: "Defendant", role: "Defendant", name: "Lake Wynonah POA" }
    ],
    judgments: [{ date: "01/02/2023", creditor: "DOE, JANE", debtor: "Lake Wynonah POA", amount: "$900.00" }]
  });
  assert.equal(c.caseKind, "LW defendant/debtor");
  assert.equal(c.duesClass, "");
  assert.equal(c.judgmentTotalAgainstLW, 900);
  assert.equal(c.opposingParties, "DOE, JANE");
});

test("toCSV quotes values", () => {
  assert.equal(toCSV([{ a: 'x"y', b: 1 }], ["a", "b"]), 'a,b\n"x""y","1"\n');
});

test("falls back to results-row participants when the detail page was not read", () => {
  const c = analyzeCase({
    caseNumber: "2021-SU-000032", scrapeError: "no detail link",
    listRow: { listParticipants: [{ prefix: "Pla", name: "DOE, JANE" }, { prefix: "Def", name: "LAKE WYNONAH POA" }] }
  });
  assert.equal(c.caseKind, "LW defendant/debtor");
  assert.equal(c.opposingParties, "DOE, JANE");
});

test("ledger tracks status history and diff reports changes", () => {
  const day1 = [analyzeCase({ ...duesCase, status: "Open" })];
  const day2 = [analyzeCase({
    ...duesCase,
    dispositionFinal: "S - Satisfied",
    dockets: [...duesCase.dockets, { date: "07/01/2021", category: "SATISFACTION", description: "ORDER TO SATISFY" }]
  }), analyzeCase({ caseNumber: "2024-NO-000009", caption: "LWPOA vs. Roe", participants: [] })];

  const ledger = { cases: {} };
  updateLedger(ledger, day1, "2026-01-01");
  updateLedger(ledger, day2, "2026-02-01");
  const h = ledger.cases["2019-NO-000123"];
  assert.equal(h.firstSeen, "2026-01-01");
  assert.equal(h.lastSeen, "2026-02-01");
  assert.deepEqual(h.statusHistory.map(s => s.status), ["Open", "Closed"]);

  const types = diffCases(day1, day2).map(c => c.type).sort();
  assert.deepEqual(types, ["dispositionFinal-changed", "judgment-status-changed", "judgmentStatus-changed", "new-case", "new-docket", "status-changed"]);
  assert.deepEqual(diffCases(day2, day1).filter(c => c.type === "missing-case").map(c => c.caseNumber), ["2024-NO-000009"]);
});
