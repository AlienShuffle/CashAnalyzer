import { readFileSync } from 'fs';
import process from 'process';

const accessionNumberListBuffer = readFileSync(process.argv[2], 'utf8');
const accessionNumberList = accessionNumberListBuffer.split('\n');
for (let i = 0; i < accessionNumberList.length; i++)
    accessionNumberList[i] = accessionNumberList[i].replace(' ', '');
function isValidAccession(num) {
    for (let i = 0; i < accessionNumberList.length; i++)
        if (accessionNumberList[i] == num)
            return true;
    return false;
}
const downloadedFilesBuffer = readFileSync(process.stdin.fd, 'utf-8');
const downloadedList = downloadedFilesBuffer.split('\n');
for (let i = 0; i < downloadedList.length; i++) {
    const path = downloadedList[i];
    if (path.length == 0) continue;
    const pathSplits = path.split('/');
    // use just the file name, not the whole path.
    const fileName = pathSplits[pathSplits.length - 1];
    // lop off the file type suffix.
    const accessionNumber = fileName.replace('.xml', '').replace('.json', '');
    // only use last 18 characters, as beginning of file name includes filingDate
    if (isValidAccession(accessionNumber.substring(accessionNumber.length-18))) continue;
    console.log(path);
}