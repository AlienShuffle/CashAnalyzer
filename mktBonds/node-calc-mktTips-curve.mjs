// Fits the TIPS Svensson zero curve from the published mktTips rows.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { daysBetween, normalizeDate } from "./lib/dates.mjs";
import { roundPrice, roundTo, roundYield } from "./lib/rounding.mjs";
import { analyzeTipsZero, nominalZeroYtm, svenssonZero, zeroCcToBEY } from "./lib/zero/index.mjs";

function dateOnly(value) {
    const date = normalizeDate(value);
    if (!date || !Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MARKET_YTM_NEIGHBORS = 6;

// Local linear fit of observed nominal yields on maturity (years) over the nearest bonds, evaluated at
// the target maturity; null when the target lies outside the observed maturities.
function nominalMarketYtm(curveDate, maturity, fitBonds) {
    const base = normalizeDate(curveDate);
    const years = date => daysBetween(base, normalizeDate(date)) / 365;
    const target = years(maturity);
    const points = fitBonds.map(bond => ({ x: years(bond.maturity), y: bond.ytm }));
    if (points.length < 2 || target < Math.min(...points.map(p => p.x)) || target > Math.max(...points.map(p => p.x))) return null;
    const near = points.sort((a, b) => Math.abs(a.x - target) - Math.abs(b.x - target)).slice(0, MARKET_YTM_NEIGHBORS);
    const meanX = near.reduce((s, p) => s + p.x, 0) / near.length;
    const meanY = near.reduce((s, p) => s + p.y, 0) / near.length;
    const sxx = near.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
    const slope = sxx > 0 ? near.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0) / sxx : 0;
    return roundYield(meanY + slope * (target - meanX));
}

const RICH_CHEAP_THRESHOLD_BP = 2;

// Market yield above the curve (positive residual) is cheap, below is rich; small residuals stay blank.
function richCheap(residualBp) {
    if (Math.abs(residualBp) < RICH_CHEAP_THRESHOLD_BP) return "";
    return residualBp > 0 ? "cheap" : "rich";
}

const BASES = ["settle", "settle-sa", "settle-sa-decay", "forward", "forward-sa", "forward-sa-decay"];

/**
 * @param {Array<object>} tipsRows output rows from node-mktTips-update.mjs
 * @param {{basis?: "settle"|"settle-sa"|"settle-sa-decay"|"forward"|"forward-sa"|"forward-sa-decay"}} options settle uses the settlement date and
 *   market clean price; forward uses the forward (maxREFCPI) date and the unadjusted forward clean
 *   price; settle-sa multiplies settle_clean_price by settle_mature_sa_ratio; forward-sa multiplies that price by fwd_mature_sa_ratio (seasonally adjusted). Bonds
 *   settle-sa-decay uses settle_mature_sa_ratio_decay; forward-sa-decay uses fwd_mature_sa_ratio_decay. Bonds
 *   maturing on or before the forward date are excluded from every curve.
 * @return {object} dated Svensson fit and per-bond diagnostics
 */
export function buildTipsCurveAnalysis(tipsRows, { basis = "settle", nominalCurve = null } = {}) {
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
    const forward = basis.startsWith("forward");
    const settleDate = forward ? forwardDate : [...settlementDates][0];
    const priceField = forward ? "fwd_clean_price" : "settle_clean_price";
    const ratioField = { "settle-sa": "settle_mature_sa_ratio", "settle-sa-decay": "settle_mature_sa_ratio_decay", "forward-sa": "fwd_mature_sa_ratio", "forward-sa-decay": "fwd_mature_sa_ratio_decay" }[basis];
    const seasonal = ratioField !== undefined;
    const bonds = tipsRows
        .filter(row => normalizeDate(row.maturity_date) > normalizeDate(forwardDate))
        .filter(row => !seasonal || Number.isFinite(Number(row[ratioField])) && row[ratioField] != null)
        .map(row => ({
            cusip: row.cusip,
            maturity: row.maturity_date,
            coupon: row.interest_rate,
            cleanPrice: seasonal ? row[priceField] * row[ratioField] : row[priceField],
        }));
    if (nominalCurve && dateOnly(nominalCurve.settleDate) !== dateOnly(settleDate)) {
        throw new Error(`Nominal curve date ${nominalCurve.settleDate} does not match the ${basis} curve date ${settleDate}`);
    }
    const fit = analyzeTipsZero(settleDate, bonds);

    return {
        asOfDate,
        basis,
        settleDate,
        method: "Svensson",
        params: fit.params,
        objective: fit.objective,
        rows: fit.rows.map((row, index) => {
            const residualBp = roundTo(row.residualBp, 3);
            const nominalModelYield = nominalCurve
                ? roundYield(nominalZeroYtm(settleDate, row.maturity, row.coupon, nominalCurve.params))
                : undefined;
            const nominalMarketYield = nominalCurve
                ? nominalMarketYtm(settleDate, row.maturity, nominalCurve.fitBonds)
                : undefined;
            const years = daysBetween(normalizeDate(settleDate), normalizeDate(row.maturity)) / 365;
            const zeroBei = nominalCurve
                ? roundYield(zeroCcToBEY(svenssonZero(years, nominalCurve.params)) - zeroCcToBEY(svenssonZero(years, fit.params)))
                : undefined;
            const nominalResidualBp = nominalMarketYield == null ? null : roundTo((nominalMarketYield - nominalModelYield) * 10000, 3);
            // marketBei - modelBei, i.e. the nominal residual less the TIPS residual.
            const beiResidualBp = nominalResidualBp == null ? null : roundTo(nominalResidualBp - residualBp, 3);
            return {
                cusip: bonds[index].cusip,
                maturity: dateOnly(row.maturity),
                coupon: row.coupon,
                marketClean: roundPrice(row.marketClean),
                modelClean: roundPrice(row.modelClean),
                priceResidual: roundPrice(row.priceResidual),
                marketYtm: row.marketYtm,
                modelYtm: row.modelYtm,
                residualBp,
                richCheap: richCheap(residualBp),
                ...(nominalCurve && {
                    nominalMarketYtm: nominalMarketYield,
                    marketBei: nominalMarketYield == null ? null : roundYield(nominalMarketYield - row.marketYtm),
                    nominalModelYtm: nominalModelYield,
                    modelBei: roundYield(nominalModelYield - row.modelYtm),
                    nominalResidualBp,
                    beiResidualBp,
                    zeroBei,
                }),
            };
        }),
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const basis = (process.argv[2] || "--basis=settle").replace(/^--basis=/, "");
    const tipsRows = JSON.parse(fs.readFileSync(0, "utf-8"));
    const nominalArg = process.argv.slice(3).find(arg => arg.startsWith("--nominalCurve="));
    const nominalCurve = nominalArg ? JSON.parse(fs.readFileSync(nominalArg.slice("--nominalCurve=".length), "utf-8")) : null;
    console.log(JSON.stringify(buildTipsCurveAnalysis(tipsRows, { basis, nominalCurve })));
}
