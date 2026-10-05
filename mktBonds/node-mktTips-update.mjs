// Joins TIPS reference data (TIPSmeta.csv format on stdin) with the latest published mktBonds
// quotes and adds settlement/forward REFCPI, seasonal ratios and the forward clean price.
// Options (single argument, space separated): --repoRate=auto|<decimal> --priceSide=ask|bid --mktBonds=<path>
// repoRate=auto derives the financing rate from the T-bills bracketing the forward date.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";
import { nextWeekday, normalizeDate } from "./lib/dates.mjs";
import { roundTo } from "./lib/rounding.mjs";
import { applyCredibilityFactor, createRefCpiTable, loadRefCpiTable } from "./lib/tips/index.mjs";
import { forwardTipsCleanPrice, tbillRepoRate } from "./lib/forwards/index.mjs";

export const REPORT_SOURCE = "Fidelity";
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

const round5 = v => (v == null ? null : roundTo(v, 5));

/**
 * @param {object[]} meta rows from TIPSmeta.csv
 * @param {object[]} quotes published mktBonds rows
 * @param {{getRefCpi:Function,getFactor:Function,maxDate:Date}} table REFCPI lookups
 */
export function buildTipsRows(meta, quotes, table, { repoRate, priceSide }) {
    const quoteByCusip = new Map(quotes.filter(q => q.securitytype === "TIPS").map(q => [q.cusip, q]));
    const t1 = table.maxDate;
    const rows = [];

    // One financing rate per run: settlement follows the bills' own report date.
    let repo = repoRate;
    if (repo === "auto") {
        const bills = quotes.filter(q => q.securitytype === "Bill" && Number(q[priceSide]) > 0);
        if (bills.length === 0) throw new Error("No T-bill quotes available to derive the repo rate");
        const billSettle = nextWeekday(bills[0].asOfDate.slice(0, 10));
        repo = tbillRepoRate(billSettle, t1, bills.map(b => ({ maturity: b.maturitydate, price: b[priceSide] }))).rate;
    }

    for (const m of meta) {
        const quote = quoteByCusip.get(m.cusip);
        const price = quote ? Number(quote[priceSide]) : NaN;
        if (!quote || !(price > 0)) continue;

        const reportDate = quote.asOfDate.slice(0, 10);
        const t0 = nextWeekday(reportDate);
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
        // Published maturities have an exact factor; later ones decay toward 1.0.
        const matureDecay = table.getRefCpi(maturity) != null
            ? matureFactor
            : applyCredibilityFactor(matureFactor, t0, maturity);

        rows.push({
            cusip: m.cusip,
            interest_rate: coupon,
            security_term: Number(m.security_term),
            series: m.series,
            maturity_date: m.maturity_date,
            dated_date: m.dated_date,
            report_source: REPORT_SOURCE,
            asOfDate: quote.asOfDate,
            settle_date: toIso(t0),
            fwd_date: toIso(t1),
            settle_clean_price: price,
            dated_refcpi: datedRefCpi,
            settle_refcpi: settleRefCpi,
            fwd_refcpi: fwdRefCpi,
            settle_mature_sa_ratio: matureFactor ? round5(settleFactor / matureFactor) : null,
            settle_mature_sa_ratio_decay: matureDecay ? round5(settleFactor / matureDecay) : null,
            fwd_mature_sa_ratio: matureFactor ? round5(fwdFactor / matureFactor) : null,
            repo_rate: round5(repo),
            fwd_clean_price_unadjusted: forwardTipsCleanPrice({
                settle: t0, forward: t1, maturity, coupon, price, datedRefCpi, settleRefCpi,
                forwardRefCpi: fwdRefCpi, repoRate: repo, getRefCpi: table.getRefCpi,
            }),
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
    console.log(JSON.stringify(buildTipsRows(meta, quotes, table, options)));
}
