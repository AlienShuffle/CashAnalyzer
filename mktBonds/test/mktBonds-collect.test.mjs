import test from "node:test";
import assert from "node:assert/strict";
import { parseDownloadDate } from "../node-collect-mktBonds.mjs";

test("parseDownloadDate returns date and 24-hour HHMM", () => {
    assert.equal(parseDownloadDate("x\nDate downloaded   10/02/2026 02:05 PM"), "2026-10-02T1405");
    assert.equal(parseDownloadDate("Date downloaded   1/5/2026 12:30 AM"), "2026-01-05T0030");
    assert.equal(parseDownloadDate("Date downloaded   1/5/2026 12:30 PM"), "2026-01-05T1230");
    assert.throws(() => parseDownloadDate("nothing"), /Date downloaded/);
});
