// Reads the collector's JSON records on stdin and writes the published mktBonds table as JSON.
// Columns follow the FedInvest table; rate is the coupon as a decimal and bid/ask are per $100.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { roundPrice, roundYield } from "./lib/rounding.mjs";

export function toPublishedRows(records) {
    return records.map(r => ({
        asOfDate: r.asOfDate,
        cusip: r.cusip,
        securitytype: r.securityType,
        rate: r.coupon === null ? "" : roundYield(r.coupon / 100),
        maturitydate: r.maturityDate,
        bid: r.bidPrice === null ? "" : roundPrice(r.bidPrice),
        ask: r.askPrice === null ? "" : roundPrice(r.askPrice),
        frequency: r.frequency,
        description: r.description,
        key: `${r.maturityDate}-${r.cusip}`
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const records = JSON.parse(fs.readFileSync(0, "utf-8"));
    console.log(JSON.stringify(toPublishedRows(records)));
}
