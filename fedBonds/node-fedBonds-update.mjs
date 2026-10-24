// Adapt the processed FedInvest daily table to the shared bond quote schema.
import { readText } from "../lib/jsonIO.mjs";
import { pathToFileURL } from "node:url";
import { roundPrice, roundYield } from "../mktBonds/lib/rounding.mjs";

const TYPES = {
    "MARKET BASED BILL": "Bill",
    "MARKET BASED NOTE": "Bond",
    "MARKET BASED BOND": "Bond",
    "MARKET BASED FRN": "FRN",
    TIPS: "TIPS",
};

function dateOnly(value, field) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
        || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
        throw new Error(`Invalid FedInvest ${field}: ${value}`);
    }
    return value;
}

function number(value, field) {
    if (value == null || String(value).trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
        throw new Error(`Invalid FedInvest ${field}: ${value}`);
    }
    return Number(value);
}

function price(value, field) {
    if (value == null || String(value).trim() === "") return "";
    const parsed = number(value, field);
    return parsed === 0 ? "" : roundPrice(parsed);
}

export function toPublishedRows(records) {
    if (!Array.isArray(records) || records.length === 0) throw new Error("FedInvest input must be a non-empty array");
    const cusips = new Set();
    const rows = records.map(record => {
        const securitytype = TYPES[record.securitytype];
        if (!securitytype) throw new Error(`Unsupported FedInvest security type: ${record.securitytype}`);
        if (typeof record.cusip !== "string" || !/^[A-Z0-9]{9}$/.test(record.cusip) || cusips.has(record.cusip)) {
            throw new Error(`Invalid or duplicate FedInvest CUSIP: ${record.cusip}`);
        }
        cusips.add(record.cusip);
        // FedInvest already expresses coupons as decimals, not percentage points.
        const coupon = number(record.rate, `${record.cusip} rate`);
        return {
            asOfDate: dateOnly(record.asOfDate, "asOfDate"),
            cusip: record.cusip,
            securitytype,
            interest_rate: roundYield(coupon),
            maturity_date: dateOnly(record.maturitydate, "maturitydate"),
            // Buy/sell are from the investing agency's perspective.
            bid: price(record.sell, `${record.cusip} sell`),
            ask: price(record.buy, `${record.cusip} buy`),
            description: `${record.securitytype} ${coupon * 100}% ${record.maturitydate}`,
        };
    });
    if (new Set(rows.map(row => row.asOfDate)).size !== 1) throw new Error("FedInvest rows must have one common asOfDate");
    return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    console.log(JSON.stringify(toPublishedRows(JSON.parse(await readText()))));
}
