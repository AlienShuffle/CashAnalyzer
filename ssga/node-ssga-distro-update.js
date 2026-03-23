import { readFileSync } from "fs";
import dynamicSort from '../lib/dynamicSort.mjs';
import { duGetISOString } from "../lib/dateUtils.mjs";
function safeObjectRef(obj) { return (typeof obj === 'undefined') ? '' : obj; }

const ticker = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : '';
if (ticker == '') throw 'missing argv[2] ticker!';

const contentText = readFileSync(0, 'utf-8');
const json = JSON.parse(contentText);
let results = [];
for (let i = 0; i < json.length; i++) {
    const fund = json[i];
    let rowData = {
        "ticker": ticker,
        source: "ssga",
        timestamp: new Date
    };
    if (safeObjectRef(fund.recordDate))
        rowData.recordDate = duGetISOString(new Date(fund.recordDate));
    if (safeObjectRef(fund.exDate))
        rowData.exDividendDate = duGetISOString(new Date(fund.exDate));
    if (safeObjectRef(fund.payableDate))
        rowData.payableDate = duGetISOString(new Date(fund.payableDate));
    if (safeObjectRef(fund.dividend) &&
        (fund.dividend != '-') &&
        ((fund.dividend * 1) > 0))
        rowData.ordinaryIncome = fund.dividend * 1;
    if (safeObjectRef(fund.shortTeamCapital) &&
        (fund.shortTeamCapital != '-') &&
        ((fund.shortTeamCapital * 1) > 0))
        rowData.stcg = fund.shortTeamCapital * 1;
    if (safeObjectRef(fund.longTeamCapital) &&
        (fund.longTeamCapital != '-') &&
        ((fund.longTeamCapital * 1) > 0))
        rowData.ltcg = fund.longTeamCapital * 1;
    const total = rowData.ordinaryIncome + rowData.stcg + rowData.ltcg;
    if (total > 0)
        rowData.totalDistribution = total;
    results.push(rowData);
}
console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));