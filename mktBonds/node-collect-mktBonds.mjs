import { pathToFileURL } from "node:url";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";

const baseUrl = "https://pub-ba11062b177640459f72e0a88d0261ae.r2.dev/Treasuries/MarketQuotes.csv";

const requiredColumns = [
    "type",
    "cusip",
    "coupon",
    "maturity",
    "askprice",
    "bidprice"
];

function normalizeMaturityDate(value) {
    const match = value.trim().match(/^(\d{4})[-:](\d{1,2})-\s*(\d{1,2})$/);
    if (!match) return "";

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return "";
    }

    return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseOptionalNumber(value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "--") return null;

    const number = Number(trimmed);
    if (!Number.isFinite(number)) {
        throw new Error(`Invalid numeric value in Treasury CSV: ${value}`);
    }
    return number;
}

export function getSecurityType(product, description, frequency) {
    const upperProduct = product.trim().toUpperCase();
    const upperDescription = description.trim().toUpperCase();

    if (upperProduct === "TIPS") return "TIPS";
    if (/\bSTRIPP?(?:ED)?\b/.test(upperDescription)) return "STRIP";
    if (/\bBILLS?\b/.test(upperDescription)) return "Bill";
    if (/\b(?:NTS?|NOTES?|BDS?|BONDS?)\b/.test(upperDescription) || frequency.trim()) {
        return "Bond";
    }

    throw new Error(`Unable to determine security type for ${product}: ${description}`);
}

const DOWNLOAD_TIME_ZONE = "America/Los_Angeles";
const MARKET_TIME_ZONE = "America/New_York";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function zonedParts(instantMs, timeZone) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(instantMs)).map(p => [p.type, p.value]));
    return parts;
}

// Wall-clock fields in fromZone -> the same instant as wall-clock fields in toZone.
function convertWallClock(year, month, day, hour, minute, fromZone, toZone) {
    const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    let instant = wallAsUtc;
    for (let i = 0; i < 2; i++) {
        const p = zonedParts(instant, fromZone);
        const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
        instant += wallAsUtc - shown;
    }
    return zonedParts(instant, toZone);
}

// The footer line reads "Date downloaded   10/02/2026 02:05 PM" in the downloader's (Pacific) local
// time; returns the market (New York) time as "2026-10-02T1705".
export function parseDownloadDate(csvText, { from = DOWNLOAD_TIME_ZONE, to = MARKET_TIME_ZONE } = {}) {
    const match = csvText.match(/Date downloaded\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (!match) {
        throw new Error("Treasury CSV is missing its 'Date downloaded' line.");
    }
    const [, month, day, year, hourText, minute, meridiem] = match;
    const hour = Number(hourText) % 12 + (meridiem.toUpperCase() === "PM" ? 12 : 0);
    const t = convertWallClock(Number(year), Number(month), Number(day), hour, Number(minute), from, to);
    return `${t.year}-${t.month}-${t.day}T${t.hour}${t.minute}`;
}

function parseMarketQuoteDate(value) {
    const match = value.trim().replace(/^\uFEFF/, "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
    if (!match) {
        throw new Error("Market quotes CSV is missing its YYYY-MM-DD HH:MM timestamp.");
    }

    const [, yearText, monthText, dayText, hourText, minuteText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day
        || hour > 23 || minute > 59) {
        throw new Error(`Invalid market quotes timestamp: ${value}`);
    }
    const marketTime = convertWallClock(year, month, day, hour, minute, DOWNLOAD_TIME_ZONE, MARKET_TIME_ZONE);
    return `${marketTime.year}-${marketTime.month}-${marketTime.day}T${marketTime.hour}${marketTime.minute}`;
}

function getMarketQuoteSecurityType(product, coupon, cusip) {
    if (product.toUpperCase() === "TIPS") return "TIPS";
    if (product.toUpperCase() !== "TREASURY") {
        throw new Error(`Unsupported Treasury product type: ${product}`);
    }
    if (coupon > 0) return "Bond";

    // The feed omits security subtype; the 912797 CUSIP family identifies Treasury bills.
    return cusip.startsWith("912797") ? "Bill" : "STRIP";
}

function makeDescription(securityType, coupon, maturityDate) {
    const [year, month, day] = maturityDate.split("-");
    const couponPercent = (coupon * 100).toFixed(3);
    const securityLabel = {
        Bill: "TREAS BILLS ZERO CPN",
        Bond: "TREASURY",
        STRIP: "TREASURY STRIP ZERO CPN",
        TIPS: "TREAS BDS TIPS"
    }[securityType];
    return `UNITED STATES ${securityLabel}, ${couponPercent}%, ${day}-${MONTHS[Number(month) - 1]}-${year}`;
}

export function parseTreasuryCsv(csvText) {
    const rows = parseCsvToMatrix(csvText);
    if (rows.length < 2) {
        throw new Error("Treasury CSV is empty.");
    }

    const asOfDate = parseMarketQuoteDate(rows[0][0] ?? "");
    const header = rows[1].map(value => value.trim().replace(/^\uFEFF/, "").toLowerCase());
    const columnIndexes = Object.fromEntries(
        requiredColumns.map(column => [column, header.indexOf(column)])
    );
    const missingColumns = requiredColumns.filter(column => columnIndexes[column] < 0);
    if (missingColumns.length > 0) {
        throw new Error(`Treasury CSV is missing required columns: ${missingColumns.join(", ")}`);
    }

    const records = [];
    for (const row of rows.slice(2)) {
        const product = row[columnIndexes.type]?.trim() ?? "";
        const cusip = row[columnIndexes.cusip]?.trim() ?? "";
        if (!product && !cusip) continue;
        if (!product || !cusip) {
            throw new Error("Market quotes CSV contains a row without a product type or CUSIP.");
        }
        if (!/^[A-Z0-9]{9}$/i.test(cusip)) {
            throw new Error(`Invalid CUSIP in market quotes CSV: ${cusip}`);
        }

        const maturityDate = normalizeMaturityDate(row[columnIndexes.maturity] ?? "");
        if (!maturityDate) {
            throw new Error(`Invalid maturity date for market quote ${cusip}.`);
        }

        const coupon = parseOptionalNumber(row[columnIndexes.coupon] ?? "");
        if (coupon === null || coupon < 0) {
            throw new Error(`Invalid coupon for market quote ${cusip}.`);
        }
        const bidPrice = parseOptionalNumber(row[columnIndexes.bidprice] ?? "");
        const askPrice = parseOptionalNumber(row[columnIndexes.askprice] ?? "");
        const securityType = getMarketQuoteSecurityType(product, coupon, cusip);
        records.push({
            asOfDate,
            product,
            description: makeDescription(securityType, coupon, maturityDate),
            cusip,
            coupon: coupon === 0 ? null : coupon * 100,
            frequency: "",
            maturityDate,
            bidPrice,
            askPrice,
            securityType
        });
    }

    if (records.length === 0) {
        throw new Error("Market quotes CSV did not contain any valid security rows.");
    }
    return records;
}

async function main() {
    const response = await fetch(baseUrl);
    if (!response.ok) {
        throw new Error(`Treasury CSV request failed: ${response.status} ${response.statusText}`);
    }

    const records = parseTreasuryCsv(await response.text());
    console.log(JSON.stringify(records));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await main();
}
