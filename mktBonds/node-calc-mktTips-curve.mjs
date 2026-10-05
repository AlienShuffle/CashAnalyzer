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

/**
 * @param {Array<object>} tipsRows output rows from node-mktTips-update.mjs
 * @param {{basis?: "settle"|"forward"}} options settle uses the settlement date and market clean
 *   price; forward uses the forward (maxREFCPI) date and the forward clean price. Bonds maturing on
 *   or before the forward date are excluded from both curves.
 * @return {object} dated Svensson fit and per-bond diagnostics
 */
export function buildTipsCurveAnalysis(tipsRows, { basis = "settle" } = {}) {
    if (!["settle", "forward"].includes(basis)) throw new Error("basis must be settle or forward");
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
    const settleDate = basis === "forward" ? forwardDate : [...settlementDates][0];
    const priceField = basis === "forward" ? "fwd_clean_price_unadjusted" : "settle_clean_price";
    const bonds = tipsRows
        .filter(row => normalizeDate(row.maturity_date) > normalizeDate(forwardDate))
        .map(row => ({
            cusip: row.cusip,
            maturity: row.maturity_date,
            coupon: row.interest_rate,
            cleanPrice: row[priceField],
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
