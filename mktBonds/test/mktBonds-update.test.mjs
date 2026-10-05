import test from "node:test";
import assert from "node:assert/strict";
import { toPublishedRows } from "../node-mktBonds-update.mjs";

test("toPublishedRows publishes coupons as decimal rates", () => {
    const [row] = toPublishedRows([{
        asOfDate: "2026-10-05T0505",
        cusip: "91282CJC6",
        securityType: "Bond",
        coupon: 4.625,
        maturityDate: "2026-10-15",
        bidPrice: 100.007,
        askPrice: 100.02,
        frequency: "semi-annually",
        description: "UNITED STATES TREAS SER AT-2026",
    }]);

    assert.equal(row.rate, "0.04625");
});

test("toPublishedRows keeps missing coupons blank", () => {
    const [row] = toPublishedRows([{
        asOfDate: "2026-10-05T0505",
        cusip: "912797UJ4",
        securityType: "Bill",
        coupon: null,
        maturityDate: "2026-10-08",
        bidPrice: 99.978,
        askPrice: 99.98,
        frequency: "",
        description: "UNITED STATES TREAS BILLS ZERO CPN",
    }]);

    assert.equal(row.rate, "");
});
