import test from "node:test";
import assert from "node:assert/strict";
import { parseDownloadDate } from "../node-collect-mktBonds.mjs";

test("parseDownloadDate returns date and 24-hour HHMM", () => {
    assert.equal(parseDownloadDate("x\nDate downloaded   10/02/2026 02:05 PM"), "2026-10-02T1705");
    assert.equal(parseDownloadDate("Date downloaded   1/5/2026 12:30 AM"), "2026-01-05T0330");
    assert.equal(parseDownloadDate("Date downloaded   1/5/2026 12:30 PM"), "2026-01-05T1530");
    // Crossing midnight, and the weeks when Pacific and New York DST differ.
    assert.equal(parseDownloadDate("Date downloaded   10/02/2026 09:30 PM"), "2026-10-03T0030");
    assert.equal(parseDownloadDate("Date downloaded   3/10/2026 08:00 AM"), "2026-03-10T1100");
    assert.equal(parseDownloadDate("Date downloaded   3/5/2026 08:00 AM"), "2026-03-05T1100");
    assert.throws(() => parseDownloadDate("nothing"), /Date downloaded/);
});
