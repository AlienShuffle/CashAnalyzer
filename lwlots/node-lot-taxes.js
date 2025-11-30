import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

// read HTML from file given as 1st argument, this is a parcel detail report from the county GIS site.
const htmlString = readFileSync(process.argv[2], 'utf8');
const root = parse(htmlString);

// body > table > tbody > tr:nth-child(3) > td > div > center > table > tbody > tr:nth-child(3) > td > table > tbody > tr:nth-child(5) > td:nth-child(1) > b

const contentElementArray = root.querySelectorAll('td');
if (!contentElementArray) {

    console.error("Error: Could not find td elements in HTML.");
    process.exit(1);
}
//console.error(`Found content element with ${contentElementArray.length} child nodes.`);

let result = {
    lot: process.argv[3].split('-')[2].split('.')[0] * 1,
    parcel: process.argv[3],
    timestamp: new Date()
};
for (let i = 0; i < contentElementArray.length; i++) {
    const element = contentElementArray[i];
    const nextElement = contentElementArray[i + 1];

    if (element.text.includes("NAME:")) {
        result.owners = nextElement.text.trim();
    }
    if (element.text.includes("ADDRESS:")) {
        result.address = nextElement.text.trim();
        for (let j = 3; j <= 8; j += 2) {
            result.address += "\n" + contentElementArray[i + j].text.trim().replace(/[\s\r\t]+/g, ' ')
            if (contentElementArray[i + j + 1].text.includes("LOCATION:")) break;
        }
    }
    if (element.text.includes("LOCATION:")) {
        result.location = nextElement.text.trim();
    }
    if (element.text.includes("ASSESSED VALUE:")) {
        //console.error(`${i}: Found ASSESSED VALUE element: ${element.text.trim()}::${nextElement.text.trim()}:`);
        result.assessment = nextElement.text.trim().replace(/[\$,]/g, '') * 1;
    }
    if (element.text.includes("No Delinquent Taxes on file.")) {
        console.error(`\tNo Delinquent Taxes on file.`);
        result.delinquent = false;
        break;
    }
    if (element.text.includes("Delinquent Taxes Due")) {
        console.error(`\tDelinquent Taxes Due`);
        result.lastDeliquentYear = contentElementArray[i + 2].text.trim() * 1;
        result.taxesDue = contentElementArray[i + 3].text.trim().replace(/[\$,]/g, '') * 1;
        for (let j = i + 2; j < contentElementArray.length; j++) {
            if (contentElementArray[j].text.trim() == "Total") {
                //console.error(`${j}: Found Total`);
                result.taxesDue = contentElementArray[j + 2].text.trim().replace(/[\$,]/g, '') * 1;
                result.saleType = contentElementArray[j - 3].text.trim()
                result.firstDeliquentYear = contentElementArray[j - 5].text.trim() * 1;
                break;
            }
        }
        break;
    }
}
console.log(JSON.stringify(result));