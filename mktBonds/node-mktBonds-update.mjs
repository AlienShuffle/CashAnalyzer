// Reads the collector's JSON records on stdin and writes the published mktBonds table as JSON.
// Columns follow the FedInvest table; rate is the coupon as a decimal and bid/ask are per $100.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export function toPublishedRows(records) {
    return records.map(r => ({
        asOfDate: r.asOfDate,
        cusip: r.cusip,
        securitytype: r.securityType,
        rate: r.coupon === null ? "" : (r.coupon / 100).toFixed(5),
        maturitydate: r.maturityDate,
        bid: r.bidPrice === null ? "" : r.bidPrice.toFixed(5),
        ask: r.askPrice === null ? "" : r.askPrice.toFixed(5),
        frequency: r.frequency,
        description: r.description,
        key: `${r.maturityDate}-${r.cusip}`
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const records = JSON.parse(fs.readFileSync(0, "utf-8"));
    console.log(JSON.stringify(toPublishedRows(records)));
}
