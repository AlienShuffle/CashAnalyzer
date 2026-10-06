// Joins TIPS reference data (TIPSmeta.csv format on stdin) with the latest published mktBonds
// quotes and adds settlement/forward REFCPI, seasonal ratios and the forward clean price.
// Options (single argument, space separated): --repoRate=auto|<decimal> --priceSide=ask|bid --mktBonds=<path>
// repoRate=auto derives the financing rate from the T-bills bracketing the forward date.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";
import { getSettlementDate, normalizeDate } from "./lib/dates.mjs";
import { loadSifmaHolidays } from "./lib/holidays.mjs";
import { roundSeasonal, roundYield } from "./lib/rounding.mjs";
import { applyCredibilityFactor, createRefCpiTable, loadRefCpiTable } from "./lib/tips/index.mjs";
import { forwardTipsCleanPrice, tbillRepoRate } from "./lib/forwards/index.mjs";
import { yieldFromPrice } from "./lib/yield.mjs";

export const REPORT_SOURCE = "Market";
const defaultMktBonds = path.join(os.homedir(), "cloudflare/public/Treasuries/mktBonds/mktBonds-rate.json");

export function parseOptions(text = "") {
    const options = { repoRate: "auto", priceSide: "ask", mktBonds: defaultMktBonds };
    for (const token of text.split(/\s+/).filter(Boolean)) {
        const [key, value] = token.replace(/^--/, "").split("=");
        if (!(key in options) || value === undefined) throw new Error(`Unknown option: ${token}`);
        options[key] = key === "repoRate" && value !== "auto" ? Number(value) : value;
    }
    if (options.repoRate !== "auto" && !Number.isFinite(options.repoRate)) throw new Error("repoRate must be auto or a number");
    if (!["ask", "bid"].includes(options.priceSide)) throw new Error("priceSide must be ask or bid");
    return options;
}

export function parseMeta(csvText) {
    const [header, ...rows] = parseCsvToMatrix(csvText).filter(r => r.length > 1);
    return rows.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]])));
}

/**
 * @param {object[]} meta rows from TIPSmeta.csv
 * @param {object[]} quotes published mktBonds rows
 * @param {{getRefCpi:Function,getFactor:Function,maxDate:Date}} table REFCPI lookups
 * holidays: YYYY-MM-DD bond-market holidays used for the settlement date
 */
export function buildTipsRows(meta, quotes, table, { repoRate, priceSide, holidays = [] }) {
    const quoteByCusip = new Map(quotes.filter(q => q.securitytype === "TIPS").map(q => [q.cusip, q]));
    const t1 = table.maxDate;
    const rows = [];

    // One financing rate per run: settlement follows the bills' own report date.
    let repo = repoRate;
    if (repo === "auto") {
        const bills = quotes.filter(q => q.securitytype === "Bill" && Number(q[priceSide]) > 0);
        if (bills.length === 0) throw new Error("No T-bill quotes available to derive the repo rate");
        const billSettle = getSettlementDate(bills[0].asOfDate.slice(0, 10), holidays);
        repo = roundYield(tbillRepoRate(billSettle, t1, bills.map(b => ({ maturity: b.maturity_date, price: b[priceSide] }))).rate);
    }

    for (const m of meta) {
        const quote = quoteByCusip.get(m.cusip);
        const price = quote ? Number(quote[priceSide]) : NaN;
        if (!quote || !(price > 0)) continue;

        const reportDate = quote.asOfDate.slice(0, 10);
        const t0 = getSettlementDate(reportDate, holidays);
        const maturity = normalizeDate(m.maturity_date);
        if (!(t0 < maturity)) continue;

        const coupon = Number(m.interest_rate);
        const datedRefCpi = Number(m.ref_cpi_on_dated_date);
        const settleRefCpi = table.getRefCpi(t0);
        const fwdRefCpi = table.getRefCpi(t1);
        if (settleRefCpi == null || fwdRefCpi == null) {
            throw new Error(`REFCPI is not published for settle ${t0.toISOString().slice(0, 10)} or forward date`);
        }

        const settleFactor = table.getFactor(t0);
        const matureFactor = table.getFactor(maturity);
        const fwdFactor = table.getFactor(t1);
        // Published maturities have an exact factor; later ones decay toward 1.0 by the horizon
        // from the settle (t0) or forward (t1) date.
        const published = table.getRefCpi(maturity) != null;
        const matureDecay = published ? matureFactor : applyCredibilityFactor(matureFactor, t0, maturity);
        const fwdMatureDecay = published ? matureFactor : applyCredibilityFactor(matureFactor, t1, maturity);

        const forwardCleanPrice = forwardTipsCleanPrice({
            settle: t0, forward: t1, maturity, coupon, price, datedRefCpi, settleRefCpi,
            forwardRefCpi: fwdRefCpi, repoRate: repo, getRefCpi: table.getRefCpi,
        });
        const settleSaRatio = matureFactor ? roundSeasonal(settleFactor / matureFactor) : null;
        const settleSaDecayRatio = matureDecay ? roundSeasonal(settleFactor / matureDecay) : null;
        const forwardSaRatio = matureFactor ? roundSeasonal(fwdFactor / matureFactor) : null;
        const forwardSaDecayRatio = fwdMatureDecay ? roundSeasonal(fwdFactor / fwdMatureDecay) : null;

        rows.push({
            cusip: m.cusip,
            interest_rate: coupon,
            security_term: Number(m.security_term),
            series: m.series,
            maturity_date: m.maturity_date,
            dated_date: m.dated_date,
            report_source: `${REPORT_SOURCE} ${priceSide}`,
            asOfDate: quote.asOfDate,
            settle_date: toIso(t0),
            fwd_date: toIso(t1),
            settle_clean_price: price,
            dated_refcpi: datedRefCpi,
            settle_refcpi: settleRefCpi,
            fwd_refcpi: fwdRefCpi,
            settle_mature_sa_ratio: settleSaRatio,
            settle_mature_sa_ratio_decay: settleSaDecayRatio,
            fwd_mature_sa_ratio: forwardSaRatio,
            fwd_mature_sa_ratio_decay: forwardSaDecayRatio,
            repo_rate: repo,
            fwd_clean_price: forwardCleanPrice,
            settle_ytm: yieldFromPrice(t0, maturity, coupon, price),
            settle_sa_ytm: settleSaRatio == null ? null : yieldFromPrice(t0, maturity, coupon, price * settleSaRatio),
            settle_sa_decay_ytm: settleSaDecayRatio == null ? null : yieldFromPrice(t0, maturity, coupon, price * settleSaDecayRatio),
            forward_ytm: yieldFromPrice(t1, maturity, coupon, forwardCleanPrice),
            forward_sa_ytm: forwardSaRatio == null || forwardCleanPrice == null
                ? null
                : yieldFromPrice(t1, maturity, coupon, forwardCleanPrice * forwardSaRatio),
            forward_sa_decay_ytm: forwardSaDecayRatio == null || forwardCleanPrice == null
                ? null
                : yieldFromPrice(t1, maturity, coupon, forwardCleanPrice * forwardSaDecayRatio),
        });
    }
    return rows;
}

function toIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const options = parseOptions(process.argv.slice(2).join(" "));
    const meta = parseMeta(fs.readFileSync(0, "utf-8"));
    const quotes = JSON.parse(fs.readFileSync(options.mktBonds, "utf-8"));
    const table = await loadRefCpiTable();
    let holidays = [];
    try {
        holidays = await loadSifmaHolidays();
    } catch (error) {
        console.error(`Warning: ${error.message}; settlement dates skip weekends only.`);
    }
    console.log(JSON.stringify(buildTipsRows(meta, quotes, table, { ...options, holidays })));
}
