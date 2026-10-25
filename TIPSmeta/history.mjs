import { pathToFileURL } from "node:url";

export const AUCTIONS_URL = "https://www.treasurydirect.gov/TA_WS/securities/search?type=TIPS&format=json";
export const SUMMARY_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/tips_cpi_data_summary?page%5Bsize%5D=1000";
export const FIELDS = ["cusip", "interest_rate", "security_term", "series", "maturity_date", "dated_date", "ref_cpi_on_dated_date"];

function date(value, label) {
    const result = String(value ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result))
        || new Date(result).toISOString().slice(0, 10) !== result) throw new Error(`Invalid ${label}: ${value}`);
    return result;
}

function term(value) {
    const match = /^(\d+)-Year(?: (\d+)-Month)?$/.exec(value);
    if (!match) throw new Error(`Invalid TIPS original term: ${value}`);
    return Number(match[1]) + Number(match[2] ?? 0) / 12;
}

export function historicalMetadata(auctions, summary) {
    if (!Array.isArray(auctions) || auctions.length < 6 || !Array.isArray(summary) || !summary.length) {
        throw new Error("Missing historical auction or current TIPS metadata");
    }
    const bonds = new Map();
    for (const row of [...auctions].sort((a, b) => String(a.issueDate).localeCompare(String(b.issueDate)))) {
        if (row.inflationProtected !== "Yes") throw new Error(`Non-TIPS auction: ${row.cusip}`);
        if (!/^[A-Z0-9]{9}$/.test(row.cusip)) throw new Error(`Invalid CUSIP: ${row.cusip}`);
        const coupon = Number(row.interestRate) / 100;
        const base = Number(row.referenceCpiOnOriginalDatedDate);
        if (!row.interestRate || !row.referenceCpiOnOriginalDatedDate
            || !Number.isFinite(coupon) || !Number.isFinite(base) || !(coupon > 0) || !(base > 0)) {
            throw new Error(`Missing coupon or original reference CPI: ${row.cusip}`);
        }
        const candidate = {
            cusip: row.cusip, interest_rate: coupon, security_term: term(row.originalSecurityTerm),
            series: row.series, maturity_date: date(row.maturityDate, "maturity"),
            dated_date: date(row.originalDatedDate || row.datedDate, "original dated date"),
            ref_cpi_on_dated_date: base,
        };
        const previous = bonds.get(row.cusip);
        if (previous) {
            for (const field of ["interest_rate", "maturity_date", "ref_cpi_on_dated_date"]) {
                if (previous[field] !== candidate[field]) throw new Error(`Conflicting auction ${field}: ${row.cusip}`);
            }
        } else bonds.set(row.cusip, candidate);
    }
    for (const row of summary) {
        const bond = bonds.get(row.cusip);
        if (!bond) throw new Error(`Current TIPS missing from auction history: ${row.cusip}`);
        for (const [field, value] of Object.entries({
            interest_rate: Number(row.interest_rate) / 100,
            maturity_date: date(row.maturity_date, "summary maturity"),
            dated_date: date(row.dated_date, "summary dated date"),
            ref_cpi_on_dated_date: Number(row.ref_cpi_on_dated_date),
        })) {
            if (bond[field] !== value) throw new Error(`Auction/summary ${field} mismatch: ${row.cusip}`);
        }
        bond.series = row.series;
    }
    return [...bonds.values()].sort((a, b) => a.maturity_date.localeCompare(b.maturity_date) || a.cusip.localeCompare(b.cusip));
}

export function metadataCsv(rows) {
    const cell = value => /[,"\n]/.test(String(value)) ? `"${String(value).replaceAll('"', '""')}"` : String(value);
    return `${FIELDS.join(",")}\n${rows.map(row => FIELDS.map(field => cell(
        ["interest_rate", "ref_cpi_on_dated_date"].includes(field) ? row[field].toFixed(5) : row[field],
    )).join(",")).join("\n")}\n`;
}

export async function fetchHistoricalMetadata() {
    const get = async url => {
        const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`TIPS metadata request failed: ${response.status} ${url}`);
        return response.json();
    };
    const [auctions, summary] = await Promise.all([get(AUCTIONS_URL), get(SUMMARY_URL)]);
    if (Number(summary.meta?.["total-pages"]) !== 1) throw new Error("TIPS summary requires additional pagination");
    return historicalMetadata(auctions, summary.data);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        process.stdout.write(metadataCsv(await fetchHistoricalMetadata()));
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
