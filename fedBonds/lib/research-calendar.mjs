const iso = date => date.toISOString().slice(0, 10);
const shiftDay = (date, n) => iso(new Date(Date.parse(date) + n * 86400000));

export function checkedDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))
        || iso(new Date(value)) !== value) throw new Error(`Invalid date: ${value}`);
    return value;
}

function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
    return iso(new Date(Date.UTC(year, Math.floor(n / 31) - 1, n % 31 + 1)));
}

export function treasuryHolidays(fromYear, toYear) {
    const closed = new Set();
    const nthMonday = (year, month, n) => {
        const first = new Date(Date.UTC(year, month - 1, 1));
        return iso(new Date(Date.UTC(year, month - 1, 1 + (8 - first.getUTCDay()) % 7 + 7 * (n - 1))));
    };
    const fixed = (year, month, day) => {
        const date = iso(new Date(Date.UTC(year, month - 1, day)));
        const weekday = new Date(date).getUTCDay();
        closed.add(shiftDay(date, weekday === 6 ? -1 : weekday === 0 ? 1 : 0));
    };
    for (let year = fromYear - 1; year <= toYear + 1; year++) {
        fixed(year, 1, 1); fixed(year, 7, 4); fixed(year, 11, 11); fixed(year, 12, 25);
        if (year >= 2022) fixed(year, 6, 19);
        for (const [month, nth] of [[1, 3], [2, 3], [9, 1], [10, 2]]) closed.add(nthMonday(year, month, nth));
        const lastMay = new Date(Date.UTC(year, 5, 0));
        closed.add(shiftDay(iso(lastMay), -(lastMay.getUTCDay() + 6) % 7));
        const novemberFirst = new Date(Date.UTC(year, 10, 1));
        closed.add(iso(new Date(Date.UTC(year, 10, 1 + (11 - novemberFirst.getUTCDay()) % 7 + 21))));
        // SIFMA recommends a noon close when Good Friday coincides with the employment report.
        const goodFriday = shiftDay(easter(year), -2);
        if (Number(goodFriday.slice(8)) > 7) closed.add(goodFriday);
    }
    closed.add("2018-12-05");
    return closed;
}

export function isTradingDay(date, holidays) {
    return ![0, 6].includes(new Date(checkedDate(date)).getUTCDay()) && !holidays.has(date);
}

export function shiftTrading(date, offset, holidays) {
    checkedDate(date);
    if (!Number.isInteger(offset)) throw new Error("Trading-day offset must be an integer");
    let current = date;
    for (let remaining = Math.abs(offset); remaining;) {
        current = shiftDay(current, Math.sign(offset));
        if (isTradingDay(current, holidays)) remaining--;
    }
    return current;
}

export function tradingDistance(a, b, holidays) {
    checkedDate(a); checkedDate(b);
    const direction = b < a ? -1 : 1;
    let count = 0;
    // Count away from the release, which can occur on a closed Treasury-market day.
    for (let date = shiftDay(a, direction); direction > 0 ? date <= b : date >= b; date = shiftDay(date, direction)) {
        if (isTradingDay(date, holidays)) count++;
    }
    return direction * count;
}

export function exclusionReason(release) {
    if (release >= "2020-03-01" && release <= "2022-12-31") return "covid-and-rebound";
    if (release >= "2025-10-01" && release <= "2025-12-31") return "government-shutdown";
    return null;
}

export function buildResearchPlan(releases, { from = "2015-01-01", through = new Date().toISOString().slice(0, 10) } = {}) {
    checkedDate(from); checkedDate(through);
    if (from < "2015-01-01" || through < from) throw new Error("Research range must start in 2015 or later and end after its start");
    const holidays = treasuryHolidays(Number(from.slice(0, 4)), Number(through.slice(0, 4)));
    const sorted = [...releases].sort((a, b) => a.rlsDate.localeCompare(b.rlsDate));
    return sorted.filter(row => row.rlsDate >= from && row.rlsDate <= through).map(row => {
        checkedDate(row.rlsDate);
        const pre = shiftTrading(row.rlsDate, -5, holidays), post = shiftTrading(row.rlsDate, 5, holidays);
        const exclusion = exclusionReason(row.rlsDate);
        return {
            release: row.rlsDate, cpiDate: row.cpiDate, horizon: row.refcpiDate,
            pre, post, exclusion, included: !exclusion && post <= through && pre >= from,
            status: exclusion ? "excluded" : post > through ? "awaiting-post-date" : pre < from ? "pre-before-range" : "selected",
            filledCpiTrendRisk: row.rlsDate >= "2026-01-01" && row.rlsDate <= "2026-06-30",
        };
    });
}
