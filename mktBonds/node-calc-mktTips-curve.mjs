// Fits the TIPS Svensson zero curve from the published mktTips rows.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { normalizeDate } from "./lib/dates.mjs";
import { analyzeTipsZero } from "./lib/zero/index.mjs";

function dateOnly(value) {
    const date = normalizeDate(value);
    if (!date || !Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const BASES = ["settle", "forward", "forward-sa"];

/**
 * @param {Array<object>} tipsRows output rows from node-mktTips-update.mjs
 * @param {{basis?: "settle"|"forward"|"forward-sa"}} options settle uses the settlement date and
 *   market clean price; forward uses the forward (maxREFCPI) date and the unadjusted forward clean
 *   price; forward-sa multiplies that price by fwd_mature_sa_ratio (seasonally adjusted). Bonds
 *   maturing on or before the forward date are excluded from every curve.
 * @return {object} dated Svensson fit and per-bond diagnostics
 */
export function buildTipsCurveAnalysis(tipsRows, { basis = "settle" } = {}) {
    if (!BASES.includes(basis)) throw new Error(`basis must be one of ${BASES.join(", ")}`);
    if (!Array.isArray(tipsRows) || tipsRows.length === 0) {
        throw new Error("No mktTips rows supplied for curve analysis");
    }

    const asOfDates = new Set(tipsRows.map(row => row.asOfDate));
    const settlementDates = new Set(tipsRows.map(row => dateOnly(row.settle_date)));
    const forwardDates = new Set(tipsRows.map(row => dateOnly(row.fwd_date)));
    const [asOfDate] = asOfDates;
    if (asOfDates.size !== 1 || typeof asOfDate !== "string" || !asOfDate) {
        throw new Error("mktTips rows must have one common asOfDate");
    }
    if (settlementDates.size !== 1) {
        throw new Error("mktTips rows must have one common settlement date");
    }
    if (forwardDates.size !== 1) {
        throw new Error("mktTips rows must have one common forward date");
    }

    const forwardDate = [...forwardDates][0];
    const settleDate = basis !== "settle" ? forwardDate : [...settlementDates][0];
    const priceField = basis !== "settle" ? "fwd_clean_price_unadjusted" : "settle_clean_price";
    const seasonal = basis === "forward-sa";
    const bonds = tipsRows
        .filter(row => normalizeDate(row.maturity_date) > normalizeDate(forwardDate))
        .filter(row => !seasonal || Number.isFinite(Number(row.fwd_mature_sa_ratio)) && row.fwd_mature_sa_ratio != null)
        .map(row => ({
            cusip: row.cusip,
            maturity: row.maturity_date,
            coupon: row.interest_rate,
            cleanPrice: seasonal ? row[priceField] * row.fwd_mature_sa_ratio : row[priceField],
        }));
    const fit = analyzeTipsZero(settleDate, bonds);

    return {
        asOfDate,
        basis,
        settleDate,
        method: "Svensson",
        params: fit.params,
        objective: fit.objective,
        rows: fit.rows.map((row, index) => ({
            cusip: bonds[index].cusip,
            maturity: dateOnly(row.maturity),
            coupon: row.coupon,
            marketClean: row.marketClean,
            modelClean: row.modelClean,
            priceResidual: row.priceResidual,
            marketYtm: row.marketYtm,
            modelYtm: row.modelYtm,
            residualBp: row.residualBp,
        })),
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const basis = (process.argv[2] || "--basis=settle").replace(/^--basis=/, "");
    const tipsRows = JSON.parse(fs.readFileSync(0, "utf-8"));
    console.log(JSON.stringify(buildTipsCurveAnalysis(tipsRows, { basis })));
}
