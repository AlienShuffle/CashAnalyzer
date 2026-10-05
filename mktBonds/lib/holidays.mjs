// U.S. bond-market holidays as recommended by SIFMA. Adapted from the aerokam holidays sample.
// The page lists U.S. holidays first, then UK and Japan sections that reuse the same names
// (and call Good Friday a full closure), so only the first listing of each holiday per year
// counts. Early closes are trading days, so they are not holidays. SIFMA publishes future years
// progressively, so a later year may be incomplete.
export const SIFMA_URL = "https://www.sifma.org/resources/guides-playbooks/holiday-schedule?_rsc=9cl3v";

const US_HOLIDAY_NAMES = [
    "New Year", "Martin Luther King Day", "Presidents Day", "Good Friday", "Memorial Day", "Juneteenth",
    "U.S. Independence Day", "Labor Day", "Columbus Day", "Veterans Day", "Thanksgiving Day", "Christmas Day",
];
const FULL_DATE = /^[A-Za-z]+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s*$/;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
    "october", "november", "december"];

/**
 * Extract U.S. holiday dates from the SIFMA page payload.
 * @param {string} text page text
 * @return {string[]} sorted unique YYYY-MM-DD dates
 */
export function parseSifmaHolidays(text) {
    const pattern = /\[\\"\$\\",\s*\\"h3\\"[\s\S]*?\\"children\\":\\"([^"]+)\\"[\s\S]*?\[\\"\$\\",\s*\\"span\\"[\s\S]*?\\"children\\":\\"([^"]+)\\"/g;
    const dates = new Set();
    const seen = new Set();
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const name = match[1].replace(/\u2019/g, "'").trim();
        const holiday = US_HOLIDAY_NAMES.find(n => name.startsWith(n));
        const year = /(\d{4})\s*$/.exec(match[2])?.[1];
        if (!holiday || !year) continue;
        const key = holiday === "New Year" ? name : `${holiday} ${year}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const date = FULL_DATE.exec(match[2]);
        if (!date) continue; // early closes do not match a plain full date
        const month = MONTHS.indexOf(date[1].toLowerCase()) + 1;
        if (month === 0) continue;
        dates.add(`${date[3]}-${String(month).padStart(2, "0")}-${String(date[2]).padStart(2, "0")}`);
    }
    return [...dates].sort();
}

/** Fetch U.S. bond-market holidays from SIFMA as a Set of YYYY-MM-DD strings. */
export async function loadSifmaHolidays({ url = SIFMA_URL } = {}) {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" } });
    if (!response.ok) throw new Error(`SIFMA holiday request failed: ${response.status}`);
    const dates = parseSifmaHolidays(await response.text());
    if (dates.length < 10) throw new Error(`SIFMA holiday page parsed only ${dates.length} holidays`);
    return new Set(dates);
}
