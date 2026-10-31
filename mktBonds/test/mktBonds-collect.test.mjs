import test from "node:test";
import assert from "node:assert/strict";
import { getSecurityType, parseDownloadDate, parseTreasuryCsv } from "../node-collect-mktBonds.mjs";

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

test("getSecurityType treats interest and principal strips as STRIP", () => {
    assert.equal(getSecurityType("Treasury", "U S TREAS SEC STRIPPED INT PMT, 0.000%, 15-AUG-2056", ""), "STRIP");
    assert.equal(getSecurityType("Treasury", "UNITED STATES TREAS BD STRIPP ZERO CPN, 0.000%, 15-NOV-2026", ""), "STRIP");
    assert.equal(getSecurityType("Treasury", "UNITED STATES TREAS BDS, 6.500%, 15-NOV-2026", "semi-annually"), "Bond");
});

test("parseTreasuryCsv maps MarketQuotes rows into collector records", () => {
    const csv = [
        "2026-10-21 09:35",
        "type,cusip,maturity,coupon,askPrice,bidPrice,adjAskPrice,adjBidPrice",
        "Treasury,912797VN4,2026-10-27,0,99.948,99.947,,",
        "Treasury,91282CJK8,2027-11-15,0.04625,100.038,100.027,,",
        "TIPS,912810PS1,2027-01-15,0.02375,100.318,100.243,166.46535891,166.34201246",
        "Treasury,912803BJ1,2026-11-15,0,99.912,99.276,,"
    ].join("\n");

    const records = parseTreasuryCsv(csv);
    assert.deepEqual(records.map(({ asOfDate, product, cusip, coupon, maturityDate, bidPrice, askPrice, securityType }) => ({
        asOfDate, product, cusip, coupon, maturityDate, bidPrice, askPrice, securityType
    })), [
        {
            asOfDate: "2026-10-21T0935",
            product: "Treasury",
            cusip: "912797VN4",
            coupon: null,
            maturityDate: "2026-10-27",
            bidPrice: 99.947,
            askPrice: 99.948,
            securityType: "Bill"
        },
        {
            asOfDate: "2026-10-21T0935",
            product: "Treasury",
            cusip: "91282CJK8",
            coupon: 4.625,
            maturityDate: "2027-11-15",
            bidPrice: 100.027,
            askPrice: 100.038,
            securityType: "Bond"
        },
        {
            asOfDate: "2026-10-21T0935",
            product: "TIPS",
            cusip: "912810PS1",
            coupon: 2.375,
            maturityDate: "2027-01-15",
            bidPrice: 100.243,
            askPrice: 100.318,
            securityType: "TIPS"
        },
        {
            asOfDate: "2026-10-21T0935",
            product: "Treasury",
            cusip: "912803BJ1",
            coupon: null,
            maturityDate: "2026-11-15",
            bidPrice: 99.276,
            askPrice: 99.912,
            securityType: "STRIP"
        }
    ]);
    assert.match(records[0].description, /TREAS BILLS ZERO CPN/);
    assert.match(records[3].description, /TREASURY STRIP ZERO CPN/);
});

test("parseTreasuryCsv preserves New York local timestamps without shifting the hour or date", () => {
    for (const [timestamp, expected] of [
        ["2026-10-30 17:05", "2026-10-30T1705"],
        ["2026-01-05 17:05", "2026-01-05T1705"],
        ["2026-10-21 23:35", "2026-10-21T2335"],
        ["2026-10-30 00:05", "2026-10-30T0005"],
        ["2026-03-08 03:05", "2026-03-08T0305"],
        ["2026-11-01 01:05", "2026-11-01T0105"]
    ]) {
        const csv = [
            timestamp,
            "type,cusip,maturity,coupon,askPrice,bidPrice",
            "Treasury,912797VN4,2026-10-27,0,99.948,99.947"
        ].join("\n");

        assert.equal(parseTreasuryCsv(csv)[0].asOfDate, expected, timestamp);
    }
});

test("parseTreasuryCsv rejects invalid timestamps and missing quote columns", () => {
    assert.throws(() => parseTreasuryCsv("not-a-time\ntype,cusip,maturity,coupon,askPrice,bidPrice"), /timestamp/);
    assert.throws(() => parseTreasuryCsv(
        "2026-10-21 09:35\ntype,cusip,maturity,coupon,askPrice"
    ), /bidprice/);
});
