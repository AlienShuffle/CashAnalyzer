import { daysBetween, daysInYearFrom, normalizeDate } from "../../mktBonds/lib/dates.mjs";

export function originalSettlementPrice(row, { valuation, adjustment }, modelClean) {
    if (!["settle", "forward"].includes(valuation) || !["none", "sa", "sa-decay"].includes(adjustment)) {
        throw new Error("Invalid research curve variant");
    }
    const forward = valuation === "forward";
    const ratio = adjustment === "none" ? 1
        : row[`${forward ? "fwd" : "settle"}_mature_sa_ratio${adjustment === "sa-decay" ? "_decay" : ""}`];
    const base = forward ? row.fwd_clean_price : row.settle_clean_price;
    const settle = normalizeDate(row.settle_date), fwd = normalizeDate(row.fwd_date);
    if (!settle || !fwd || !Number.isFinite(settle.getTime()) || !Number.isFinite(fwd.getTime()) || fwd <= settle) {
        throw new Error("Research valuation requires a valid future CPI horizon");
    }
    const slope = forward
        ? row.settle_refcpi / row.fwd_refcpi * (1 + row.repo_rate * daysBetween(settle, fwd) / daysInYearFrom(settle))
        : 1;
    if (!(ratio > 0) || !Number.isFinite(slope) || !(slope > 0) || !Number.isFinite(base) || !Number.isFinite(modelClean)) {
        throw new Error("Invalid research price transformation");
    }
    const prediction = row.settle_clean_price + (modelClean - base * ratio) / (slope * ratio);
    if (!Number.isFinite(prediction) || !(prediction > 0)) throw new Error("Invalid implied settlement price");
    return prediction;
}
