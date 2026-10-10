import { parseIoArgs, readText, writeJson, runMain } from "./jsonIO.mjs";
import { duGetISOString } from "../lib/dateUtils.mjs";
import { csvToMatrix } from "../lib/utils.mjs";

const io = parseIoArgs();

runMain(async () => {
    // read the FedInvest price CSV and convert it to JSON.
    const rows = csvToMatrix(await readText(io.input));

    // create the headers list for JSON tags.
    const headers = [
        'asOfDate',
        'cusip',
        'securitytype',
        'rate',
        'maturitydate',
        'calldate',
        'buy',
        'sell',
        'endofday'
    ];

    // This parses the rate table and puts in an array for conversion to JSON.
    let data = [];
    for (let row = 0; row < rows.length; row++) {
        const cols = rows[row];
        let rowData = {};
        if (cols.length == 9) {
            for (let col = 0; col < cols.length; col++) {
                const value = cols[col];
                switch (headers[col]) {
                    case 'asOfDate':
                    case 'maturitydate':
                        rowData[headers[col]] = duGetISOString(new Date(value));
                        break;
                    case 'rate':
                    case 'endofday':
                        rowData[headers[col]] = (parseFloat(value)).toFixed(5);
                        break;
                    default:
                        rowData[headers[col]] = value;
                        break;
                }
            }
            rowData.key = rowData.maturitydate + '-' + rowData.rate;
            data.push(rowData);
        }
    }
    await writeJson(data, io.output);
});
