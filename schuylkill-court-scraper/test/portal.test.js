import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { launchBrowser, newPage, collectResults, scrapeCaseDetail } from "../lib/portal.js";

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("portal extraction against guide-modeled fixture pages", async (t) => {
  const server = http.createServer((req, res) => {
    const file = req.url.startsWith("/CaseDetails/") ? "case-detail-primereact.html"
      : req.url.startsWith("/Case/CaseDetail") ? "case-detail.html" : "results.html";
    res.writeHead(200, { "content-type": "text/html" });
    res.end(fs.readFileSync(path.join(FIX, file)));
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await launchBrowser();
  t.after(async () => { await browser.close(); server.close(); });
  const page = await newPage(browser);

  await t.test("results rows, list participants and click-captured detail URLs", async () => {
    await page.goto(`${base}/results`);
    const rows = await collectResults(page);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].caseNumber, "2019-NO-000123");
    assert.equal(rows[0].plaintiffs, "LAKE WYNONAH PROPERTY OWNERS ASSOCIATION");
    assert.equal(rows[1].defendants, "LAKE WYNONAH POA");
    assert.equal(rows[0].opened, "03/04/2019");
    assert.equal(rows[1].status, "Closed");
    assert.equal(rows[1].detailUrl, `${base}/Case/CaseDetail?caseNumber=2021-SU-000032`);
    assert.equal(page.url(), `${base}/results`);
  });

  await t.test("case detail sections and participant carousel", async () => {
    const c = await scrapeCaseDetail(page, `${base}/Case/CaseDetail?caseNumber=2019-NO-000123`);
    assert.equal(c.caseNumber, "2019-NO-000123");
    assert.equal(c.caption, "Lake Wynonah Property Owners Association vs. John Smith");
    assert.equal(c.caseType, "Judgment: Transcript from District Justice");
    assert.equal(c.status, "Open");
    assert.equal(c.dateFiled, "03/04/2019");
    assert.equal(c.dateClosed, "");
    assert.equal(c.daysOpen, "2450");
    assert.equal(c.dispositionAopc, "03/01/2019 - A - Default Judgment");
    assert.equal(c.referenceNumbers, "MJ-21302-CV-0000123-2018");
    assert.deepEqual(c.dispositions, [{ date: "03/01/2019", category: "AOPC", result: "Default Judgment" }]);
    assert.deepEqual(c.dockets.map(d => [d.date, d.category, d.attachments]), [["06/01/2020", "PRAECIPE", "0"], ["03/04/2019", "TRANSCRIPT", "1"]]);
    assert.deepEqual(c.judgments, [{ date: "03/04/2019", creditor: "Lake Wynonah Property Owners Association", debtor: "John Smith", description: "", amount: "$1,234.50" }]);
    assert.deepEqual(c.participants.map(p => [p.side, p.role, p.name]), [
      ["Plaintiff", "Plaintiff", "LAKE WYNONAH PROPERTY OWNERS ASSOCIATION"],
      ["Plaintiff", "Attorney", "Connie Patterson"],
      ["Defendant", "Defendant", "SMITH, JOHN"],
      ["Defendant", "Defendant", "SMITH, MARY"],
      ["Defendant", "Attorney", "DEWEY, CHEATUM AND HOWELL, LLC"]
    ]);
    assert.equal(c.participants[3].address, "14 Lake Dr, Auburn, PA 17922");
    assert.equal(c.participants[2].primary, true);
  });

  await t.test("live PrimeReact detail layout: all carousel items, docket attachments", async () => {
    const c = await scrapeCaseDetail(page, `${base}/CaseDetails/Index/1`);
    assert.equal(c.caseNumber, "2025-J-000999");
    assert.equal(c.status, "Open");
    assert.equal(c.dateFiled, "12/18/2025");
    assert.deepEqual(c.participants.map(p => [p.side, p.role, p.name, p.address]), [
      ["Plaintiff", "Plaintiff", "LAKE WYNONAH PROPERTY OWNERS ASSOCIATION", "1 MAIN ST, AUBURN, PA 17922"],
      ["Defendant", "Defendant", "JANE Q DOE", "10 SAMPLE DR, AUBURN, PA 17922"],
      ["Defendant", "Defendant", "JOHN R DOE", "10 SAMPLE DR, APT 2, AUBURN, PA 17922"]
    ]);
    assert.deepEqual(c.dockets.map(d => [d.date, d.category, d.attachments]), [["12/18/2025", "JUDGMENT / RULE 236 NOTICE PROVIDED", "2"]]);
    assert.equal(c.judgments[0].amount, "$1,500.00");
  });
});
