import test from "node:test";
import assert from "node:assert/strict";
import { getSettlementDate, parseSifmaHolidays } from "../lib/index.mjs";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const item = (name, date) => `[\\"$\\",\\"h3\\",null,{\\"children\\":\\"${name}\\"}],[\\"$\\",\\"span\\",null,{\\"children\\":\\"${date}\\"}],`;

test("parseSifmaHolidays keeps full U.S. closures only", () => {
    const text = [
        item("Martin Luther King Day", "Monday, January 19, 2026"),
        item("Good Friday ", "Early Close (12:00 p.m. Eastern Time): Friday, April 3, 2026"),
        item("U.S. Independence Day (observed)", "Friday, July 3, 2026"),
        item("New Year’s Day 2026/2027", "Friday, January 1, 2027"),
        item("Boxing Day (Substitute)", "Monday, December 28, 2026"),
        item("Martin Luther King Day", "Monday, January 19, 2026"),
        item("Good Friday", "Friday, April 3, 2026"),
    ].join("");
    assert.deepEqual(parseSifmaHolidays(text), ["2026-01-19", "2026-07-03", "2027-01-01"]);
});

test("getSettlementDate skips weekends and holidays", () => {
    assert.equal(iso(getSettlementDate("2026-10-02")), "2026-10-05");
    assert.equal(iso(getSettlementDate("2026-10-09")), "2026-10-12");
    assert.equal(iso(getSettlementDate("2026-10-09", ["2026-10-12"])), "2026-10-13");
    assert.equal(iso(getSettlementDate("2026-12-31", new Set(["2027-01-01"]))), "2027-01-04");
});
