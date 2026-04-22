import { readFileSync } from 'fs';

const lotReportBuffer = readFileSync(0, 'utf8');
const lotReportJson = JSON.parse(lotReportBuffer);
function getlotReport(lot) {
    for (let i = 0; i < lotReportJson.length; i++) {
        const lotReport = lotReportJson[i];
        if (lotReport.lot === lot) {
            return lotReport;
        }
    }
    return null;
}

let result = [];
for (let i = 0; i < lotReportJson.length; i++) {

    // remove infrastructure lots.
    const generalOwner = lotReportJson[i].generalOwner;
    if (generalOwner === 'LWPOA') continue;
    if (generalOwner === 'PCMA') continue;
    if (generalOwner === 'SERVICE ELECTRIC COMPANY') continue;
    result.push(lotReportJson[i]);
}
console.log(JSON.stringify(result));