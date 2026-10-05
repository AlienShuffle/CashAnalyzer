import { pathToFileURL } from "node:url";
import { parseCsvToMatrix } from "../lib/parseCsv.mjs";

const baseUrl = "https://pub-ba11062b177640459f72e0a88d0261ae.r2.dev/Treasuries/FidelityTreasuriesTips.csv";

const requiredColumns = [
    "product",
    "description",
    "cusip",
    "coupon",
    "frequency",
    "maturity date",
    "bid price/quantity (min)",
    "ask price/quantity (min)"
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

function parsePrice(value) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "--") return null;

    const match = trimmed.match(/^(-?\d+(?:\.\d+)?)(?:\/|$)/);
    if (!match) {
        throw new Error(`Invalid Treasury price quote: ${value}`);
    }
    return Number(match[1]);
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

export function parseTreasuryCsv(csvText) {
    const asOfDate = parseDownloadDate(csvText);
    const rows = parseCsvToMatrix(csvText);
    if (rows.length === 0) {
        throw new Error("Treasury CSV is empty.");
    }

    const header = rows[0].map(value => value.trim().replace(/^\uFEFF/, "").toLowerCase());
    const columnIndexes = Object.fromEntries(
        requiredColumns.map(column => [column, header.indexOf(column)])
    );
    const missingColumns = requiredColumns.filter(column => columnIndexes[column] < 0);
    if (missingColumns.length > 0) {
        throw new Error(`Treasury CSV is missing required columns: ${missingColumns.join(", ")}`);
    }

    const records = [];
    for (const row of rows.slice(1)) {
        const product = row[columnIndexes.product]?.trim() ?? "";
        const description = row[columnIndexes.description]?.trim() ?? "";
        const cusip = row[columnIndexes.cusip]?.trim() ?? "";
        if (!product || !description || !cusip) continue;
        if (!["TREASURY", "TIPS"].includes(product.toUpperCase())) continue;

        const maturityDate = normalizeMaturityDate(row[columnIndexes["maturity date"]] ?? "");
        if (!maturityDate) {
            throw new Error(`Invalid maturity date for Treasury security ${cusip}.`);
        }

        const couponText = row[columnIndexes.coupon]?.trim() ?? "";
        records.push({
            asOfDate,
            product,
            description,
            cusip,
            coupon: parseOptionalNumber(couponText),
            frequency: row[columnIndexes.frequency]?.trim() ?? "",
            maturityDate,
            bidPrice: parsePrice(row[columnIndexes["bid price/quantity (min)"]] ?? ""),
            askPrice: parsePrice(row[columnIndexes["ask price/quantity (min)"]] ?? ""),
            securityType: getSecurityType(
                product,
                description,
                row[columnIndexes.frequency] ?? ""
            )
        });
    }

    if (records.length === 0) {
        throw new Error("Treasury CSV did not contain any valid security rows.");
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
