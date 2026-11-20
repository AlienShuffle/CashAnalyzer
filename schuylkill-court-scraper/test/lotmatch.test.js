import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, parseCaseName, parseOwnerName, nameMatch, buildLotIndex, matchCaseToLots, summarizeByLot } from "../lib/lotmatch.js";

const lots = [
  {
    lot: "762", parcel: "34-21-0762.000", location: "762 CHEYENNE DR", address: "45 OAK ST\nREADING PA 196011234",
    owners: ["SMITH, JOHN A", "SMITH, MARY"], saleDate: "2010-05-01",
    previousOwners: [{ owners: ["JONES R & L"], saleDate: "1990-01-01" }]
  },
  {
    lot: "763", parcel: "34-21-0763.000", location: "763 CHEYENNE DR", address: "763 CHEYENNE DR\nAUBURN PA 17922",
    owners: ["DOE, JANE"], saleDate: "2005-01-01", previousOwners: []
  },
  {
    lot: "900", parcel: "34-21-0900.000", location: "900 PAPOOSE DR", address: "PO BOX 7\nAUBURN PA 17922",
    owners: ["QUALITY CONTROL PATTERN &"], saleDate: "1985-01-01", previousOwners: []
  }
];
const index = buildLotIndex(lots);
const match = (defendants, filedIso = "2019-06-01") => matchCaseToLots({ caseNumber: "J-1", filedIso, defendants }, index);

test("address parsing normalizes suffixes, zip+4 and care-of lines", () => {
  assert.equal(parseAddress("762 CHEYENNE DRIVE, AUBURN, PA 17922").key, "762|CHEYENNE|DR");
  assert.equal(parseAddress("C/O MR X, 2459 PAPOOSE COVE, AUBURN, PA 179229501").key, "2459|PAPOOSE|CV");
  assert.equal(parseAddress("P.O. Box 12, Auburn PA 17922").poBox, "12");
});

test("name matching handles portal and lot-data name orders", () => {
  assert.equal(nameMatch(parseCaseName("JOHN A SMITH, JR"), parseOwnerName("SMITH, JOHN A")), "full");
  assert.equal(nameMatch(parseCaseName("SMITH JR, JOHN"), parseOwnerName("SMITH, JOHN A")), "full");
  assert.equal(nameMatch(parseCaseName("J SMITH"), parseOwnerName("SMITH, JOHN A")), "initial");
  assert.equal(nameMatch(parseCaseName("JAYNE M D'ATTILIO"), parseOwnerName("DATTILIO, JAYNE M")), "full");
  assert.equal(nameMatch(parseCaseName("TRACY VANDER MUELEN"), parseOwnerName("VANDERMUELEN, TRACY")), "full");
  assert.equal(nameMatch(parseCaseName("QUALITY CONTROL PATTERN & MODEL INC"), parseOwnerName("QUALITY CONTROL PATTERN &")), "full");
});

test("property address and spouse names make a high-confidence match", () => {
  const [best] = match([
    { name: "JOHN SMITH", address: "762 CHEYENNE DRIVE, AUBURN, PA 17922" },
    { name: "MARY SMITH", address: "762 CHEYENNE DRIVE, AUBURN, PA 17922" }
  ]);
  assert.equal(best.lot, "762");
  assert.equal(best.confidence, "high");
});

test("an out-of-area defendant matches through the owner mailing address", () => {
  const [best] = match([{ name: "JOHN SMITH", address: "45 OAK STREET, READING, PA 19601" }]);
  assert.equal(best.lot, "762");
  assert.match(best.reasons, /mailing address/);
});

test("ownership period matters: a name-only match on a later deed is dropped", () => {
  assert.equal(match([{ name: "JOHN SMITH", address: "" }], "2019-06-01")[0].lot, "762");
  assert.deepEqual(match([{ name: "JOHN SMITH", address: "" }], "1995-06-01"), []);
});

test("garnishee banks and non-Auburn street look-alikes don't create matches", () => {
  assert.deepEqual(match([{ name: "M & T BANK", address: "1 WEST MAIN STREET, SCHUYLKILL HAVEN, PA 17972" }]), []);
  assert.deepEqual(match([{ name: "PAT NOBODY", address: "763 CHEYENNE DRIVE, SURPRISE, AZ 85374" }]), []);
});

test("lot summary combines cases: likelihood of any case and expected case count", () => {
  const [lot1, lot2] = summarizeByLot([
    { caseNumber: "A", filedYear: "2015", lot: "1", score: 100, isBest: true, confidence: "high", judgmentOpenForLW: 500 },
    { caseNumber: "B", filedYear: "2020", lot: "1", score: 50, isBest: true, confidence: "medium" },
    { caseNumber: "B", filedYear: "2020", lot: "2", score: 40, isBest: false, confidence: "low" }
  ]);
  assert.equal(lot1.lot, "1");
  assert.equal(lot1.litigationLikelihood, 100);
  assert.equal(lot1.likelyCases, 1.5);
  assert.equal(lot1.openJudgmentCases, 1);
  assert.equal(`${lot1.firstFiled}-${lot1.lastFiled}`, "2015-2020");
  assert.equal(lot2.litigationLikelihood, 20);
  assert.equal(lot2.alternativeCases, 1);
});
