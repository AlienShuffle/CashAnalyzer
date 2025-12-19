// Work on POSIX and Windows
const fs = require("fs");
const process = require("process");
require('../lib/dynamicSort.js')();
const du = require('../lib/dateUtils.js');

const ticker = (process.argv[2] && process.argv[2].length > 1) ? process.argv[2] : '';
if (ticker == '') throw 'missing argv[2]=ticker!';

const contentText = fs.readFileSync(0, 'utf-8');
const start = contentText.indexOf('<ss:Worksheet ss:Name="Distributions">');
let goodStuff = contentText.substring(start);
const closingString = '</ss:Worksheet>';
const end = goodStuff.indexOf(closingString) + closingString.length;
goodStuff = goodStuff.substring(0, end);
goodStuff = goodStuff.replace(/ss:/g, '');

let results = [];
let dataRemaining = true;
while (dataRemaining) {
    const nextRow = goodStuff.indexOf('<Row>');
    const workSheetEnd = goodStuff.indexOf('</Worksheet>');
    if (nextRow < 0 || workSheetEnd < 0 || workSheetEnd < nextRow) {
        dataRemaining = false;
        break;
    }
    let rowData = {
        ticker: ticker
    };
    for (let col = 1; col < 9; col++) {
        const dataStartString = '<Data ';
        const dataEndString = '</Data>';
        goodStuff = goodStuff.substring(goodStuff.indexOf(dataStartString));
        let dataString = goodStuff.substring(0, goodStuff.indexOf(dataEndString));
        const dataStringLength = dataString.length;
        const cell = dataString.replace(/<Data.*>/, '');

        switch (col) {
            case 1:
                rowData.recordDate = du.getISOString(new Date(cell));
                break;
            case 2:
                rowData.exDividendDate = du.getISOString(new Date(cell));
                break;
            case 3:
                rowData.payableDate = du.getISOString(new Date(cell));
                break;
            case 4:
                rowData.totalDistribution = cell * 1;
                break;
            case 5:
                rowData.ordinaryIncome = cell * 1;
                break;
            case 6:
                rowData.stcg = cell * 1;
                break;
            case 7:
                rowData.ltcg = cell * 1;
                break;
            case 8:
                rowData.returnOfCapital = cell * 1;
                break;
        }

        goodStuff = goodStuff.substring(dataStringLength + dataEndString.length);
    }
    if (!rowData.recordDate.includes('NaN-NaN')) results.push(rowData);
}
console.log(JSON.stringify(results.sort(dynamicSort('-recordDate'))));