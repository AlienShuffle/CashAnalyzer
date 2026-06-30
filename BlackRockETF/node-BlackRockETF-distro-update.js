// Work on POSIX and Windows
import { readFileSync } from "fs";
import dynamicSort from '../lib/dynamicSort.mjs';
import { duGetISOString } from "../lib/dateUtils.mjs";

const ticker = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : '';
if (ticker == '') throw 'missing argv[2] ticker!';

function parseCellValue(cell) {
    if (!cell) return '';
    const trimmed = cell.trim();
    if (!trimmed) return '';

    const numberMatch = trimmed.match(/^-?\d+(?:\.\d+)?$/);
    if (numberMatch) return Number(trimmed);

    const quotedMatch = trimmed.match(/^"(.*)"$/);
    if (quotedMatch) return quotedMatch[1];

    return trimmed;
}

function parseDateValue(value) {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return '';
    return duGetISOString(date);
}

const contentText = readFileSync(0, 'utf-8');
const sheetMatch = contentText.match(/<ss:Worksheet[^>]*ss:Name="Distributions"[^>]*>([\s\S]*?)<\/ss:Worksheet>/i);
if (!sheetMatch) {
    throw new Error('Distribution worksheet not found in BlackRock document');
}

let goodStuff = sheetMatch[1].replace(/ss:/g, '');
let results = [];
const timestamp = new Date();

const rowMatches = [...goodStuff.matchAll(/<Row>([\s\S]*?)<\/Row>/gi)];
for (const rowMatch of rowMatches) {
    const rowMarkup = rowMatch[1];
    const cells = [...rowMarkup.matchAll(/<Cell(?:[^>]*)>([\s\S]*?)<\/Cell>/gi)]
        .map((cellMatch) => {
            const cellMarkup = cellMatch[1];
            const dataMatch = cellMarkup.match(/<Data(?:[^>]*)>([\s\S]*?)<\/Data>/i);
            return dataMatch ? parseCellValue(dataMatch[1].replace(/<[^>]+>/g, '')) : '';
        });

    if (cells.length === 0) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'record date')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'ex-date')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'payable date')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'total distribution')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'income')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'st cap gains')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'lt cap gains')) continue;
    if (cells.every((cell) => typeof cell === 'string' && cell.toLowerCase() === 'return of capital')) continue;

    const rowData = {
        ticker: ticker,
        timestamp: timestamp
    };

    if (cells[0]) rowData.recordDate = parseDateValue(cells[0]);
    if (cells[1]) rowData.exDividendDate = parseDateValue(cells[1]);
    if (cells[2]) rowData.payableDate = parseDateValue(cells[2]);
    if (cells[3] !== undefined && cells[3] !== '') rowData.totalDistribution = Number(cells[3]);
    if (cells[4] !== undefined && cells[4] !== '') rowData.ordinaryIncome = Number(cells[4]);
    if (cells[5] !== undefined && cells[5] !== '') rowData.stcg = Number(cells[5]);
    if (cells[6] !== undefined && cells[6] !== '') rowData.ltcg = Number(cells[6]);
    if (cells[7] !== undefined && cells[7] !== '') rowData.returnOfCapital = Number(cells[7]);

    if (rowData.recordDate && !String(rowData.recordDate).includes('NaN')) {
        results.push(rowData);
    }
}

console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));