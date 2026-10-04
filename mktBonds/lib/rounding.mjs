// Rounding conventions for Treasury/TIPS values. Ported from mybond.utils.gs (appscript-src/).
//
// | Data element           | Rule                                  |
// | Real yield             | 3 decimal places (5 as a decimal)     |
// | Reference CPI, ratios  | truncate to 6, round to 5 places      |
// | Clean price per $100   | round to 6 places                     |
// | Published CPI-U        | 3 places                              |
import { roundToFixed } from "../../lib/utils.mjs";

export const roundTo = roundToFixed;

export function roundYield(value) { return roundToFixed(value, 5, 6); }
export function roundRefCpi(value) { return roundToFixed(value, 5, 6); }
export function roundPrice(value) { return roundToFixed(value, 6); }
export function roundCpi(value) { return roundToFixed(value, 3); }
export function roundSeasonal(value) { return roundToFixed(value, 5, 6); }
