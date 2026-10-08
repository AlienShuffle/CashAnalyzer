// Break-even inflation grid: reads the TIPS Svensson zero curve (from a mktTips-curve-* fit) and the
// nominal Svensson zero curve of the same valuation date (mktNominal-grid-*) at 6-month points out to
// 30 years, and reports the nominal minus TIPS zero rate at each point.
// Options: --tipsCurve=<path> --nominalCurve=<path>
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { daysBetween, normalizeDate } from "./lib/dates.mjs";
import { roundYield } from "./lib/rounding.mjs";
import { svenssonZero, zeroCcToBEY } from "./lib/zero/index.mjs";
import { addMonths, POINTS } from "./node-calc-mktBonds-curve.mjs";

function dateOnly(value) {
    const date = normalizeDate(value);
    if (!date || !Number.isFinite(date.getTime())) throw new Error(`Invalid date: ${value}`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function checkCurve(curve, label) {
    if (!curve || typeof curve !== "object") throw new Error(`Missing ${label} curve`);
    if (!Array.isArray(curve.params) || curve.params.length !== 6 || !curve.params.every(Number.isFinite)) {
        throw new Error(`${label} curve must have six Svensson params`);
    }
    if (!curve.settleDate) throw new Error(`${label} curve has no settleDate`);
}

/**
 * @param {object} tipsCurve mktTips-curve-* JSON (asOfDate, basis, settleDate, params)
 * @param {object} nominalCurve mktNominal-grid-* JSON for the same asOfDate and valuation date
 * @return {object} TIPS and nominal zero rates and their spread on the 6-month grid
 */
export function buildBeiGrid(tipsCurve, nominalCurve) {
    checkCurve(tipsCurve, "TIPS");
    checkCurve(nominalCurve, "Nominal");
    if (tipsCurve.asOfDate !== nominalCurve.asOfDate) {
        throw new Error(`TIPS asOfDate ${tipsCurve.asOfDate} does not match nominal asOfDate ${nominalCurve.asOfDate}`);
    }
    const curveDate = dateOnly(tipsCurve.settleDate);
    if (dateOnly(nominalCurve.settleDate) !== curveDate) {
        throw new Error(`Nominal curve date ${nominalCurve.settleDate} does not match the TIPS curve date ${curveDate}`);
    }

    const base = normalizeDate(curveDate);
    const points = Array.from({ length: POINTS }, (_, i) => {
        const date = addMonths(base, 6 * (i + 1));
        const years = daysBetween(base, date) / 365;
        const tipsZeroCc = svenssonZero(years, tipsCurve.params);
        const nominalZeroCc = svenssonZero(years, nominalCurve.params);
        const tipsZeroBey = zeroCcToBEY(tipsZeroCc);
        const nominalZeroBey = zeroCcToBEY(nominalZeroCc);
        return {
            term: (i + 1) / 2,
            date: dateOnly(date),
            tipsZeroCc: roundYield(tipsZeroCc),
            tipsZeroBey: roundYield(tipsZeroBey),
            nominalZeroCc: roundYield(nominalZeroCc),
            nominalZeroBey: roundYield(nominalZeroBey),
            beiCc: roundYield(nominalZeroCc - tipsZeroCc),
            beiBey: roundYield(nominalZeroBey - tipsZeroBey),
        };
    });

    return {
        asOfDate: tipsCurve.asOfDate,
        basis: tipsCurve.basis,
        nominalBasis: nominalCurve.basis,
        settleDate: curveDate,
        method: "Svensson",
        tipsParams: tipsCurve.params,
        nominalParams: nominalCurve.params,
        points,
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const args = Object.fromEntries(process.argv.slice(2).map(arg => {
        const match = /^--(tipsCurve|nominalCurve)=(.+)$/.exec(arg);
        if (!match) throw new Error(`Unknown option: ${arg}`);
        return [match[1], match[2]];
    }));
    if (!args.tipsCurve || !args.nominalCurve) throw new Error("--tipsCurve and --nominalCurve are required");
    const read = file => JSON.parse(fs.readFileSync(file, "utf-8"));
    console.log(JSON.stringify(buildBeiGrid(read(args.tipsCurve), read(args.nominalCurve))));
}
