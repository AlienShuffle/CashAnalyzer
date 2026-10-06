// Reads the collector's JSON records on stdin and writes the published mktBonds table as JSON.
// interest_rate is the coupon as a decimal and bid/ask are per $100.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { roundPrice, roundYield } from "./lib/rounding.mjs";

export function toPublishedRows(records) {
    return records.map(r => ({
        asOfDate: r.asOfDate,
        cusip: r.cusip,
        securitytype: r.securityType,
        interest_rate: r.coupon === null ? "" : roundYield(r.coupon / 100),
        maturity_date: r.maturityDate,
        bid: r.bidPrice === null ? "" : roundPrice(r.bidPrice),
        ask: r.askPrice === null ? "" : roundPrice(r.askPrice),
        description: r.description,
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const records = JSON.parse(fs.readFileSync(0, "utf-8"));
    console.log(JSON.stringify(toPublishedRows(records)));
}
