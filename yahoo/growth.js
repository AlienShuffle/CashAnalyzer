/**
 * totalReturnChart.js
 *
 * Output (JSON list):
 * [
 *   { date, price, distribution, growthOf10000 },
 *   ...
 * ]
 */

import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

/* ---------- helpers ---------- */

function toISODateUTC(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

// Detect epoch seconds vs milliseconds and convert to Date
function epochToDate(ts) {
    const n = Number(ts);
    if (!Number.isFinite(n)) return null;
    return new Date(n > 1e11 ? n : n * 1000);
}

/** Binary search: first index i where arr[i] >= target (arr sorted strings) */
function lowerBound(arr, target) {
    let lo = 0, hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * Roll a non-trading-day event date to a trading day.
 * roll="next": first trading day on/after event date
 * roll="prev": last trading day on/before event date
 */
function mapToTradingDay(eventDay, tradingDays, roll = "next") {
    const i = lowerBound(tradingDays, eventDay);
    if (roll === "next") return i < tradingDays.length ? tradingDays[i] : null;
    if (i < tradingDays.length && tradingDays[i] === eventDay) return tradingDays[i];
    return i > 0 ? tradingDays[i - 1] : null;
}

/* ---------- core: extract price rows from either chart shape ---------- */

function extractPricesFromChartResult(result) {
    // Shape A: ChartResultArray => result.quotes[] with { date: Date, close, ... } [3](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartResultArray)[4](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartResultArrayQuote)
    if (Array.isArray(result?.quotes)) {
        return result.quotes
            .filter(q => q && q.close != null && Number.isFinite(q.close) && q.date)
            .map(q => ({
                date: toISODateUTC(new Date(q.date)),
                price: Number(q.close),
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Shape B: ChartResultObject => timestamp[] + indicators.quote[0].close[] [1](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartResultObject)[2](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/chart)
    if (Array.isArray(result?.timestamp) && result.timestamp.length) {
        const closes = result.indicators?.quote?.[0]?.close || [];
        const rows = [];
        for (let i = 0; i < result.timestamp.length; i++) {
            const c = closes[i];
            if (c == null || !Number.isFinite(c)) continue;
            const dt = epochToDate(result.timestamp[i]);
            if (!dt) continue;
            rows.push({ date: toISODateUTC(dt), price: Number(c) });
        }
        return rows.sort((a, b) => a.date.localeCompare(b.date));
    }

    return [];
}

/* ---------- core: extract dividends from either chart shape ---------- */

function extractDividendsFromChartResult(result) {
    const events = result?.events;

    // Shape A: ChartEventsArray => dividends is Array<ChartEventDividend> with { date: Date, amount } [5](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartEventsArray.dividends)[6](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartEventDividend)
    if (Array.isArray(events?.dividends)) {
        return events.dividends
            .filter(d => d && d.amount != null && Number.isFinite(d.amount) && d.date)
            .map(d => ({
                date: toISODateUTC(new Date(d.date)),
                amount: Number(d.amount),
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Shape B: ChartEventsObject => dividends is an object keyed by timestamp (ChartEventDividends map) [7](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartEventDividends)[8](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/ChartEventsObject.dividends)
    // We handle this defensively because payloads can vary.
    if (events?.dividends && typeof events.dividends === "object") {
        const out = [];
        for (const [k, ev] of Object.entries(events.dividends)) {
            const ts = ev?.date ?? ev?.timestamp ?? k;
            const amt = ev?.amount ?? ev?.dividends ?? ev?.dividend;
            const dt = epochToDate(ts);
            if (!dt || amt == null || !Number.isFinite(Number(amt))) continue;
            out.push({ date: toISODateUTC(dt), amount: Number(amt) });
        }
        return out.sort((a, b) => a.date.localeCompare(b.date));
    }

    return [];
}

/* ---------- main ---------- */

async function getSeries(symbol = "BIL", { months = 12, interval = "1d", roll = "next", initialInvestment = 10000 } = {}) {
    const end = new Date();
    const start = addMonths(end, -months);

    // chart() exists and is the module for fetching historical chart data [2](https://jsr.io/@gadicc/yahoo-finance2/doc/modules/chart/~/chart)[9](https://jsr.io/@gadicc/yahoo-finance2/doc/modules)
    const chartResp = await yahooFinance.chart(symbol, {
        period1: start,   // pass Date object (library normalizes)
        period2: end,
        interval,
    });

    // Normalize common wrapper shapes
    const result =
        chartResp?.chart?.result?.[0] ||
        chartResp?.result?.[0] ||
        chartResp;

    const prices = extractPricesFromChartResult(result);
    if (!prices.length) {
        // Helpful debug without requiring you to guess the shape
        const topKeys = result && typeof result === "object" ? Object.keys(result) : [];
        throw new Error(
            `No price rows extracted. Top-level keys seen: ${JSON.stringify(topKeys)}`
        );
    }

    const tradingDays = prices.map(r => r.date);
    const tradingDaySet = new Set(tradingDays);

    const dividends = extractDividendsFromChartResult(result);

    // Bucket dividends onto trading days (rolling if needed)
    const divByTradingDay = new Map();
    for (const d of dividends) {
        const eventDay = d.date;
        const amt = d.amount;
        if (!Number.isFinite(amt) || amt === 0) continue;

        const tradingDay = tradingDaySet.has(eventDay)
            ? eventDay
            : mapToTradingDay(eventDay, tradingDays, roll);

        if (!tradingDay) continue;

        divByTradingDay.set(tradingDay, (divByTradingDay.get(tradingDay) ?? 0) + amt);
    }

    // Total return index + growth of $10,000
    let trIndex = 1.0;
    const output = [];

    for (let i = 0; i < prices.length; i++) {
        const { date, price } = prices[i];
        const distribution = divByTradingDay.get(date) ?? 0;

        if (i > 0) {
            const prevPrice = prices[i - 1].price;
            if (prevPrice > 0) trIndex *= (price + distribution) / prevPrice;
        }

        output.push({
            date,
            price: Number(price.toFixed(4)),
            distribution: Number(distribution.toFixed(4)),
            growthOf10000: Number((trIndex * initialInvestment).toFixed(2)),
        });
    }

    return output;
}

/* ---------- run ---------- */

(async () => {
    const symbol = process.argv[2] || "BIL";
    const roll = (process.argv[3] || "next").toLowerCase(); // next|prev

    const series = await getSeries(symbol, { roll, initialInvestment: 10000 });
    console.log(JSON.stringify(series, null, 2));
})().catch(err => {
    console.error("Error:", err?.message || err);
    process.exitCode = 1;
});