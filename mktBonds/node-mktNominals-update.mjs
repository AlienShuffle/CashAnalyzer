// Publishes selected-side nominal prices and yields on the TIPS settlement/forward date grid.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { getSettlementDate, normalizeDate } from "./lib/dates.mjs";
import { loadSifmaHolidays } from "./lib/holidays.mjs";
import { loadRefCpiTable } from "./lib/tips/index.mjs";
import { forwardNominalCleanPrice, tbillRepoRate } from "./lib/forwards/index.mjs";
import { roundYield } from "./lib/rounding.mjs";
import { yieldFromPrice } from "./lib/yield.mjs";
import { parseOptions, REPORT_SOURCE } from "./node-mktTips-update.mjs";

export function buildNominalRows(quotes, forwardDate, { repoRate = "auto", priceSide = "ask", holidays = [] } = {}) {
    if (!["ask", "bid"].includes(priceSide)) throw new Error("priceSide must be ask or bid");
    if (repoRate !== "auto" && !Number.isFinite(repoRate)) throw new Error("repoRate must be auto or a number");
    const dates = new Set(quotes.map(q => q.asOfDate));
    const [asOfDate] = dates;
    if (dates.size !== 1 || typeof asOfDate !== "string" || !asOfDate) {
        throw new Error("mktBonds quotes must have one common asOfDate");
    }
    const settle = getSettlementDate(asOfDate.slice(0, 10), holidays);
    const forward = normalizeDate(forwardDate);
    if (!forward || !Number.isFinite(forward.getTime()) || forward < settle) {
        throw new Error("Forward date must be valid and cannot precede settlement");
    }
    const repo = repoRate === "auto"
        ? roundYield(tbillRepoRate(settle, forward, quotes
            .filter(q => q.securitytype === "Bill" && Number(q[priceSide]) > 0)
            .map(q => ({ maturity: q.maturity_date, price: q[priceSide] }))).rate)
        : repoRate;
    const rows = [];
    for (const quote of quotes) {
        if (!["Bond", "Bill"].includes(quote.securitytype)) continue;
        const price = Number(quote[priceSide]);
        const maturity = normalizeDate(quote.maturity_date);
        if (!(price > 0) || !(maturity > settle)) continue;
        const coupon = Number(quote.interest_rate);
        const forwardPrice = forwardNominalCleanPrice({
            settle, forward, maturity, coupon, price, repoRate: repo,
        });
        rows.push({
            cusip: quote.cusip,
            interest_rate: coupon,
            security_type: quote.securitytype,
            description: quote.description,
            maturity_date: quote.maturity_date,
            report_source: `${REPORT_SOURCE} ${priceSide}`,
            asOfDate: quote.asOfDate,
            settle_date: toIso(settle),
            fwd_date: toIso(forward),
            settle_clean_price: price,
            repo_rate: repo,
            fwd_clean_price: forwardPrice,
            settle_ytm: yieldFromPrice(settle, maturity, coupon, price),
            forward_ytm: yieldFromPrice(forward, maturity, coupon, forwardPrice),
            bid: quote.bid,
            ask: quote.ask,
        });
    }
    return rows;
}

function toIso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const options = parseOptions(process.argv.slice(2).join(" "));
    const quotes = JSON.parse(fs.readFileSync(options.mktBonds, "utf-8"));
    const table = await loadRefCpiTable({ asOfDate: options.asOfDate });
    let holidays = [];
    try {
        holidays = await loadSifmaHolidays();
    } catch (error) {
        console.error(`Warning: ${error.message}; settlement dates skip weekends only.`);
    }
    console.log(JSON.stringify(buildNominalRows(quotes, table.maxDate, { ...options, holidays })));
}
