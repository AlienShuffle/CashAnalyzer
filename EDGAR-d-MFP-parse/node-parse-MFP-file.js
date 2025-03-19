import { XMLParser } from 'fast-xml-parser';
import { XMLValidator } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a JSON file of tickers with EDGAR keys.
// { "ticker","cik","series","class" }
const fundListBuffer = readFileSync(process.argv[2], 'utf8');
const fundList = JSON.parse(fundListBuffer);
function findFund(cik, series, classId) {
    for (let i = 0; i < fundList.length; i++) {
        if (fundList[i].cik == cik && fundList[i].series == series, fundList[i].class == classId)
            return fundList[i];
    }
    return '';
}

// read in the MFP XML file from stdin.
const xmlFile = readFileSync(0, 'utf8');
// validate the file to know it will parse.
const result = XMLValidator.validate(xmlFile);
if (result.err) throw "XML is invalid because of - " + result.err.msg

// parse the XML into Javascript object tree (like normal JSON from a Javascript perspective)
const parser = new XMLParser();
const json = parser.parse(xmlFile);

// get header data
const headerData = json.edgarSubmission.headerData;
const submissionType = headerData.submissionType;
const cik = headerData.filerInfo.filer.filerCredentials.cik;
console.log('submissionType: ' + submissionType);
console.log('cik: ' + cik);

const formData = json.edgarSubmission.formData;
const reportDate = formData.generalInfo.reportDate;
const seriesId = formData.generalInfo.seriesId;
const classesId = formData.classLevelInfo.classesId;

const registrantFullName = formData.generalInfo.registrantFullName;
const nameOfSeries = formData.generalInfo.nameOfSeries;
const classLevelInfo = formData.classLevelInfo;
console.log("classLevelInfo.length=" + classLevelInfo.length);
const scheduleOfPortfolioSecuritiesInfo = formData.scheduleOfPortfolioSecuritiesInfo;
console.log("scheduleOfPortfolioSecuritiesInfo.length=" + scheduleOfPortfolioSecuritiesInfo.length);
for (let i = 0; i < classLevelInfo.length; i++) console.log(classLevelInfo[i].classFullName);
// need to loop through the classlevel info after creating all the necessasry info for the rest of the common data.
// need to then also collect class specific data as well.
//const className = formData.classLevelInfo.classFullName;
//const name = registrantFullName + ' ' + nameOfSeries + ' ' + className;
console.log('reportDate: ' + reportDate);
console.log('seriesId: ' + seriesId);

// does this report match one of the tickers we track?
const match = findFund(cik, seriesId);
if (!match) {
    console.log('no match.');
} else {
    console.log('matches ticker = ' + match.ticker);
    // here we produce a JSON object to export
    let resp = {
        "ticker": match.ticker,
        "reportDate": reportDate,
        "registrantFullName": registrantFullName,
        "nameOfSeries": nameOfSeries,
        "className": name,

    };
}










// *********************************************
//
// recursively log the object tree in the object,
// mostly to understand structure and generic
// references to unknown structure in javascript.
function deepLog(object, level = 0) {
    // for simplicity limit depth (optional).
    if (level > 2) return;
    const pad = new Array(level + 1).join('+');
    if (Object.prototype.toString.call(object) === '[object Object]') {
        Object.entries(object).forEach(([key, value]) => {
            console.log(pad + key + '=' + value);
        });
        Object.keys(object).forEach((k) => {
            deepLog(object[k], level + 1);
        });
    }
    if (Object.prototype.toString.call(object) === '[object Array]') {
        console.log(pad + key + '[' + object.length + ']=' + value);
    }
}
function doLog() {
    console.log('##### keys');
    Object.keys(json).forEach(key => {
        console.log(key);
    });
    console.log('##### entries');
    Object.entries(json).forEach(([key, value]) => {
        console.log(key + ':' + value);
    });
    console.log('##### deep log');
    deepLog(json, 0);
    deepLog(formData, 0);
}