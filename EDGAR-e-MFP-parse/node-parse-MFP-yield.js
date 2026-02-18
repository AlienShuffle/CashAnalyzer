//import { duGetDateFromYYYYMMDD } from "../lib/dateUtils.mjs";
import dynamicSort from '../lib/dynamicSort.mjs';
import { XMLParser } from 'fast-xml-parser';
import { XMLValidator } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

const debug = false;

// create a lookup array of all the funds I want to track from the mmFun input list
// the list is a JSON file of tickers with EDGAR keys.
// { "ticker","cik","series","class" }
const fundListBuffer = readFileSync(process.argv[2], 'utf8');
const fundList = JSON.parse(fundListBuffer);
function findFund(cik, series, classId) {
    for (let i = 0; i < fundList.length; i++) {
        if (fundList[i].cik == cik && fundList[i].series == series, fundList[i].class == classId) {
            if (debug) console.log('found:' + cik + ':' + series + ':' + classId)
            return fundList[i];
        }
    }
    return '';
}
if (debug) console.log('fundList.length=' + fundList.length)

// read in the MFP XML file from stdin.
const xmlFile = readFileSync(process.stdin.fd, 'utf8');
// validate the file to know it will parse.
const result = XMLValidator.validate(xmlFile);
if (result.err) throw "XML invalid: " + result.err.msg

// parse the XML into Javascript object tree (like normal JSON from a Javascript perspective)
const parser = new XMLParser();
const json = parser.parse(xmlFile);
if (debug) console.log('json.length=' + json.length)

// get header data about the fund.
const headerData = json.edgarSubmission.headerData;
const submissionType = headerData.submissionType.replace('/^NT /', '').replace('/\/A$/', '').substring(0, 6);

//if (submissionType != 'N-MFP3') process.exit(0);

if (debug) console.log('submissionType=' + submissionType)
const cik = headerData.filerInfo.filer.filerCredentials.cik;

const formData = json.edgarSubmission.formData;
const reportDate = formData.generalInfo.reportDate;
const seriesId = formData.generalInfo.seriesId;

const classLevelInfo = formData.classLevelInfo;
if (debug) console.log('classLevelInfo.length=' + classLevelInfo.length)
if (debug) console.log('Array.isArray(classLevelInfo)=' + Array.isArray(classLevelInfo))

const timestamp = new Date();
let resp = [];
function processClassInfo(classInfo) {
    // let's find out if this class is one we want to report.
    const classesId = classInfo.classesId;
    if (debug) console.log('cik=' + cik + ' series=' + seriesId + ' classesId=' + classesId)
    const match = findFund(cik, seriesId, classesId);
    if (!match) return;

    // Find the last 7 day yields published on this report.
    const sevenDayYields = classInfo.sevenDayNetYield;
    const dailyNetAssetValuePerShareClass = classInfo.dailyNetAssetValuePerShareClass;
    if (submissionType != 'N-MFP2') {
        for (let i = 1; i < sevenDayYields.length; i++) {
            const yieldNum = sevenDayYields[i].sevenDayNetYieldValue.toFixed(5) * 1;
            if (yieldNum > 0) {
                // find daily NAV.
                let nav = 1;
                for (let n = 0; n < dailyNetAssetValuePerShareClass.length; n++) {
                    if (sevenDayYields[i].sevenDayNetYieldDate ==
                        dailyNetAssetValuePerShareClass[n].dailyNetAssetValuePerShareDateClass) {
                        nav = dailyNetAssetValuePerShareClass[n].dailyNetAssetValuePerShareClass * 1;
                        break;
                    }
                }
                resp.push({
                    "asOfDate": sevenDayYields[i].sevenDayNetYieldDate,
                    "nav": nav,
                    "sevenDayYield": yieldNum,
                    "source": 'EDGAR MFP-3',
                    "ticker": match.ticker,
                    "timestamp": timestamp,
                });
            }
        }
    } else {
        resp.push({
            "asOfDate": reportDate,
            "nav": 1,
            "sevenDayYield": sevenDayYields.toFixed(5) * 1,
            "source": 'EDGAR MFP-2',
            "ticker": match.ticker,
            "timestamp": timestamp,
        });
    }
}

if (Array.isArray(classLevelInfo)) {
    for (let classIndex = 0; classIndex < classLevelInfo.length; classIndex++) {
        const classInfo = classLevelInfo[classIndex];
        processClassInfo(classInfo);
    }
} else {
    processClassInfo(classLevelInfo);
}

console.log(
    JSON.stringify(
        resp.sort(
            dynamicSort('-asOfDate')
        )
    )
);