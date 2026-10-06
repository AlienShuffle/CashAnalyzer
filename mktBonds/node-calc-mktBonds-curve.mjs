// Fits a Svensson nominal zero curve from the published mktBonds ask quotes and publishes it as
// 6-month points out to 30 years, for later break-even inflation work against the TIPS zero curves.
// stdin: published mktTips rows (supply asOfDate, settle date, forward/maxREFCPI date and repo rate).
// Options (single argument, space separated): --basis=settle|forward --mktBonds=<path>
//   --priceSide=ask|bid --maxDeviationBp=<bp>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeDate, daysBetween } from "./lib/dates.mjs";
import { forwardNominalCleanPrice } from "./lib/forwards/index.mjs";
import { roundTo, roundYield } from "./lib/rounding.mjs";
import { accruedInterest } from "./lib/coupons.mjs";
import { yieldFromPrice } from "./lib/yield.mjs";
import { fitTipsSvensson, svenssonDF, svenssonZero, tipsZeroModelPrice, zeroCcToBEY } from "./lib/zero/index.mjs";

const BASES = ["settle", "forward"];
const NOMINAL_TYPES = new Set(["Bond", "Bill"]);
const POINTS = 60;
const defaultMktBonds = path.join(os.homedir(), "cloudflare/public/Treasuries/mktBonds/mktBonds-rate.json");

function dateOnly(value) {
    const date = normalizeDate(value);
    if (!date || !Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Same calendar day n months later, clamped to the end of shorter months.
function addMonths(date, months) {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return target;
}

const MAX_FIT_PASSES = 5;

// Market minus model yield in bp for one bond against a fitted curve.
function yieldResidualBp(curveDate, bond, params) {
    const modelClean = tipsZeroModelPrice(curveDate, bond.maturity, bond.coupon, params) - accruedInterest(curveDate, bond.maturity, bond.coupon);
    const modelYtm = yieldFromPrice(curveDate, bond.maturity, bond.coupon, modelClean);
    return Number.isFinite(modelYtm) ? (bond.ytm - modelYtm) * 10000 : Infinity;
}

export function parseOptions(text = "") {
    const options = { basis: "settle", mktBonds: defaultMktBonds, priceSide: "ask", maxDeviationBp: 15 };
    for (const token of text.split(/\s+/).filter(Boolean)) {
        const [key, value] = token.replace(/^--/, "").split("=");
        if (!(key in options) || value === undefined) throw new Error(`Unknown option: ${token}`);
        options[key] = key === "maxDeviationBp" ? Number(value) : value;
    }
    if (!BASES.includes(options.basis)) throw new Error(`basis must be one of ${BASES.join(", ")}`);
    if (!["ask", "bid"].includes(options.priceSide)) throw new Error("priceSide must be ask or bid");
    if (!(options.maxDeviationBp > 0)) throw new Error("maxDeviationBp must be positive");
    return options;
}

/**
 * Nominal curve for a basis date. Candidates are non-STRIP notes, bonds and bills maturing after the
 * forward (maxREFCPI) date. Each is priced at the basis date (the quoted price at settlement; the
 * repo-carried forward price for the forward basis). The curve is fitted, any bond whose yield is more
 * than maxDeviationBp from the curve is treated as a bad quote, and the fit is repeated without the
 * bonds left out until the set is stable.
 * @param {object[]} quotes published mktBonds rows
 * @param {{asOfDate:string, settleDate:string, forwardDate:string, repoRate:number}} context
 * @return {object} dated Svensson fit, the excluded CUSIPs and the 6-month zero curve points
 */
export function buildNominalCurveAnalysis(quotes, context, { basis = "settle", priceSide = "ask", maxDeviationBp = 15 } = {}) {
    if (!BASES.includes(basis)) throw new Error(`basis must be one of ${BASES.join(", ")}`);
    const { asOfDate, repoRate } = context;
    const settleDate = dateOnly(context.settleDate);
    const forwardDate = dateOnly(context.forwardDate);
    const curveDate = basis === "forward" ? forwardDate : settleDate;
    if (basis === "forward" && !Number.isFinite(repoRate)) throw new Error("A repo rate is required for the forward curve");

    const candidates = [];
    for (const q of quotes) {
        if (!NOMINAL_TYPES.has(q.securitytype) || /\bSTRIP/i.test(q.description ?? "")) continue;
        const ask = Number(q[priceSide]);
        if (!(ask > 0) || !(normalizeDate(q.maturity_date) > normalizeDate(forwardDate))) continue;
        const coupon = Number(q.interest_rate) || 0;
        const cleanPrice = basis === "forward"
            ? forwardNominalCleanPrice({ settle: settleDate, forward: forwardDate, maturity: q.maturity_date, coupon, price: ask, repoRate })
            : ask;
        const ytm = cleanPrice > 0 ? yieldFromPrice(curveDate, q.maturity_date, coupon, cleanPrice) : null;
        if (!Number.isFinite(ytm)) continue;
        candidates.push({ cusip: q.cusip, maturity: q.maturity_date, coupon, cleanPrice, ytm });
    }
    candidates.sort((a, b) => (a.maturity < b.maturity ? -1 : a.maturity > b.maturity ? 1 : a.cusip < b.cusip ? -1 : 1));

    let bonds = candidates;
    let fit;
    for (let pass = 0; pass < MAX_FIT_PASSES; pass++) {
        fit = fitTipsSvensson(curveDate, bonds);
        const kept = candidates.filter(bond => Math.abs(yieldResidualBp(curveDate, bond, fit.params)) <= maxDeviationBp);
        if (kept.length === bonds.length && kept.every((bond, i) => bond === bonds[i])) break;
        bonds = kept;
    }
    const excluded = candidates
        .filter(bond => !bonds.includes(bond))
        .map(bond => ({
            cusip: bond.cusip, maturity: bond.maturity, coupon: bond.coupon, ytm: bond.ytm,
            deviationBp: roundTo(yieldResidualBp(curveDate, bond, fit.params), 3),
        }));

    const base = normalizeDate(curveDate);
    const points = Array.from({ length: POINTS }, (_, i) => {
        const date = addMonths(base, 6 * (i + 1));
        const years = daysBetween(base, date) / 365;
        const zeroCc = svenssonZero(years, fit.params);
        return {
            term: (i + 1) / 2,
            date: dateOnly(date),
            zeroCc: roundYield(zeroCc),
            zeroBey: roundYield(zeroCcToBEY(zeroCc)),
            discountFactor: roundTo(svenssonDF(years, fit.params), 6),
        };
    });

    return {
        asOfDate,
        basis,
        settleDate: curveDate,
        forwardDate,
        priceSide,
        method: "Svensson",
        params: fit.params,
        objective: fit.objective,
        bondsUsed: bonds.length,
        excluded,
        fitBonds: bonds.map(bond => ({ cusip: bond.cusip, maturity: bond.maturity, coupon: bond.coupon, ytm: bond.ytm })),
        points,
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const options = parseOptions(process.argv.slice(2).join(" "));
    const tipsRows = JSON.parse(fs.readFileSync(0, "utf-8"));
    const quotes = JSON.parse(fs.readFileSync(options.mktBonds, "utf-8"));
    const [first] = tipsRows;
    if (!first) throw new Error("No mktTips rows supplied for the nominal curve");
    const quoteDates = new Set(quotes.map(q => q.asOfDate));
    if (quoteDates.size !== 1 || !quoteDates.has(first.asOfDate)) {
        throw new Error("mktBonds quotes and mktTips rows must share one asOfDate");
    }
    const context = { asOfDate: first.asOfDate, settleDate: first.settle_date, forwardDate: first.fwd_date, repoRate: Number(first.repo_rate) };
    console.log(JSON.stringify(buildNominalCurveAnalysis(quotes, context, options)));
}
