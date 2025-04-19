import { duGetDateFromYYYYMMDD } from "../lib/dateUtils.mjs";
import { XMLParser } from 'fast-xml-parser';
import { XMLValidator } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

const debug = false;

// start some utilities here.
function titleCase(str) {
    let splitStr = str.toLowerCase().split(' ');
    for (let i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
    }
    return splitStr.join(' ');
}

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

// This is passed into the program as it is only known in the metadata.
const filingDate = process.argv[3];

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
if (debug) console.log('submissionType=' + submissionType)
const cik = headerData.filerInfo.filer.filerCredentials.cik;

const formData = json.edgarSubmission.formData;
const reportDate = formData.generalInfo.reportDate;
const seriesId = formData.generalInfo.seriesId;
const registrantFullName = formData.generalInfo.registrantFullName;
const nameOfSeries = formData.generalInfo.nameOfSeries;

const seriesLevelInfo = formData.seriesLevelInfo;
// rationalize the Fund Category type.
function mapCategory(tmpCategory) {
    const fundCategories_ = ['Government', 'Government', 'Government', 'Muni', 'Prime', 'SingleState', 'Treasury'];
    const sourceCategories_ = ['Exempt Government', 'Government', 'Government/Agency', 'Other Tax Exempt', 'Prime', 'Single State', 'Treasury'];

    for (let i = 0; i < sourceCategories_.length; i++) {
        if (sourceCategories_[i] == tmpCategory) {
            return fundCategories_[i];
        }
    }
    throw "invalid source Category: " + tmpCategory;
}
const moneyMarketFundCategory = mapCategory(
    (Array.isArray(seriesLevelInfo.moneyMarketFundCategory)) ?
        seriesLevelInfo.moneyMarketFundCategory[0] :
        seriesLevelInfo.moneyMarketFundCategory);

const retailMoneyMarketFlag = (submissionType == 'N-MFP2') ?
    ((seriesLevelInfo.fundExemptRetailFlag.toUpperCase() == 'N') ? 'Institutional' : 'Retail') :
    ((seriesLevelInfo.fundRetailMoneyMarketFlag.toUpperCase() == 'N') ? 'Institutional' : 'Retail')

const classLevelInfo = formData.classLevelInfo;
if (debug) console.log('classLevelInfo.length=' + classLevelInfo.length)
if (debug) console.log('Array.isArray(classLevelInfo)=' + Array.isArray(classLevelInfo))

const scheduleOfPortfolioSecuritiesInfo = formData.scheduleOfPortfolioSecuritiesInfo;
let investmentCategories = [
    {
        "value": 0,
        "treatment": "USGO",
        "category": "usTreasuryDebt",
        "EDGAR": "U.S. Treasury Debt"
    },
    {
        "value": 0,
        "treatment": "USGO",
        "category": "usGovernmentAgencyDebt",
        "EDGAR": "U.S. Government Agency Debt"
    },
    {
        "value": 0,
        "treatment": "USGO",
        "category": "usGovernmentAgencyCouponDebt",
        "EDGAR": "U.S. Government Agency Debt (if categorized as coupon-paying notes)"
    },
    {
        "value": 0,
        "treatment": "USGO",
        "category": "usGovernmentAgencyZeroCouponDebt",
        "EDGAR": "U.S. Government Agency Debt (if categorized as no-coupon discount notes)"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "nonUSSovereignDebt",
        "EDGAR": "Non-U.S. Sovereign, Sub-Sovereign and Supra-National debt"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "certificateofDeposit",
        "EDGAR": "Certificate of Deposit"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "nonNegotiableTimeDeposit",
        "EDGAR": "Non-Negotiable Time Deposit"
    },
    {
        "value": 0,
        "treatment": "exempt",
        "category": "variableRateDemandNote",
        "EDGAR": "Variable Rate Demand Note"
    },
    {
        "value": 0,
        "treatment": "exempt",
        "category": "otherMunicipalSecurity",
        "EDGAR": "Other Municipal Security"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "assetBackedCommercialPaper",
        "EDGAR": "Asset Backed Commercial Paper"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "otherAssetBackedSecurities",
        "EDGAR": "Other Asset Backed Securities"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "usTreasuryRepurchaseAgreement",
        "EDGAR": "U.S. Treasury Repurchase Agreement, if collateralized only by U.S. Treasuries (including Strips) and cash"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "usGovernmentAgencyRepurchaseAgreement",
        "EDGAR": "U.S. Government Agency Repurchase Agreement, collateralized only by U.S. Government Agency securities, U.S. Treasuries, and cash"
    },
    { // MFP-3
        "value": 0,
        "treatment": "other",
        "category": "otherRepurchaseAgreement",
        "EDGAR": "Other Repurchase Agreement, if collateral falls outside Treasury, Government Agency and cash"
    },
    { // MFP-2
        "value": 0,
        "treatment": "other",
        "category": "otherRepurchaseAgreement",
        "EDGAR": "Other Repurchase Agreement, if any collateral falls outside Treasury, Government Agency and cash"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "insuranceCompanyFundingAgreement",
        "EDGAR": "Insurance Company Funding Agreement"
    },
    { // MFP-3 - add as exempt to Muni Funds, otherwise taxable.
        "value": 0,
        "treatment": "other",
        "category": "financialCompanyCommercialPaper",
        "EDGAR": "Financial Company Commercial Paper"
    },
    { // MFP-2 - add as exempt to Muni Funds, otherwise taxable.
        "value": 0,
        "treatment": "other",
        "category": "financialCompanyCommercialPaper",
        "EDGAR": "Investment Company"
    },
    { // add as exempt to Muni Funds, otherwise taxable.
        "value": 0,
        "treatment": "other",
        "category": "nonFinancialCompanyCommercialPaper",
        "EDGAR": "Non-Financial Company Commercial Paper"
    },
    {
        "value": 0,
        "treatment": "exempt",
        "category": "tenderOptionBond",
        "EDGAR": "Tender Option Bond"
    },
    {
        "value": 0,
        "treatment": "other",
        "category": "otherInstrument",
        "EDGAR": "Other Instrument"
    },
];
function getCategory(EDGAR) {
    for (let i = 0; i < investmentCategories.length; i++) {
        if (investmentCategories[i].EDGAR == EDGAR)
            return i;
    }
    throw 'category not found:' + EDGAR;
}

let totalAssetsProcessed = 0;
let totalUSGO = 0;
let totalExempt = 0;
const timestamp = new Date;
let resp = [];
function processClassInfo(classInfo) {
    // let's find out if this class is one we want to report.
    const classesId = classInfo.classesId;
    if (debug) console.log('cik=' + cik + ' series=' + seriesId + ' classesId=' + classesId)
    const fundMeta = findFund(cik, seriesId, classesId);
    if (!fundMeta) return;

    // Find the last 7 day yield published on this report.
    const sevenDayYields = classInfo.sevenDayNetYield;
    let lastSevenDayYieldIndex = 0;
    let lastSevenDayYieldDate;
    if (submissionType != 'N-MFP2') {
        lastSevenDayYieldDate = duGetDateFromYYYYMMDD(sevenDayYields[0].sevenDayNetYieldDate);
        for (let i = 1; i < sevenDayYields.length; i++) {
            const newDate = duGetDateFromYYYYMMDD(sevenDayYields[i].sevenDayNetYieldDate);
            if (lastSevenDayYieldDate.getTime() < newDate.getTime()) {
                lastSevenDayYieldIndex = i;
                lastSevenDayYieldDate = newDate;
            }
        }
    }
    const yieldValue = (submissionType == 'N-MFP2') ?
        sevenDayYields :
        sevenDayYields[lastSevenDayYieldIndex].sevenDayNetYieldValue;
    const yieldDate = (submissionType == 'N-MFP2') ?
        reportDate :
        sevenDayYields[lastSevenDayYieldIndex].sevenDayNetYieldDate;

    // only process assets once and only if we have a class match.
    if (!totalAssetsProcessed) {
        for (let i = 0; i < scheduleOfPortfolioSecuritiesInfo.length; i++) {
            const category = getCategory(scheduleOfPortfolioSecuritiesInfo[i].investmentCategory);
            const value = scheduleOfPortfolioSecuritiesInfo[i].includingValueOfAnySponsorSupport * 1;
            totalAssetsProcessed += value;
            investmentCategories[category].value += value;
            if (investmentCategories[category].treatment == 'USGO') totalUSGO += value;

            // total Muni assets, commercial paper is exempt only in Exmempt funds, therefore special processing.
            if (
                (investmentCategories[category].treatment == 'exempt') ||
                (
                    (moneyMarketFundCategory == 'Muni' || moneyMarketFundCategory == 'SingleState') &&
                    (investmentCategories[category].category == 'financialCompanyCommercialPaper' ||
                        investmentCategories[category].category == 'nonFinancialCompanyCommercialPaper')
                )
            ) {
                totalExempt += value;
            }

        }
    }

    const metaAsOfDateObj = duGetDateFromYYYYMMDD(fundMeta.asOfDate);
    const metaYear = metaAsOfDateObj.getFullYear();
    const reportDateObj = duGetDateFromYYYYMMDD(reportDate);
    const reportYear = reportDateObj.getFullYear();
    const expenseRatio = (metaYear == reportYear) ? fundMeta.expenseRatio : null;

    // create and export the resulting ticker symbol EDGAR report.
    let item = {
        "ticker": fundMeta.ticker,
        "source": "parse-MFP-files.sh",
        "registrantName": titleCase((registrantFullName) ? registrantFullName : fundMeta.entity_name),
        "seriesName": titleCase((nameOfSeries) ? nameOfSeries : fundMeta.series_name),
        "className": titleCase((classInfo.classFullName) ? classInfo.classFullName : fundMeta.class_name),
        "mmName": fundMeta.mmName,
        "expenseRatio": expenseRatio,
        "fiscalYearEnd": fundMeta.fiscalYearEnd,
        "category": moneyMarketFundCategory,
        "totalNetAssets": classInfo.netAssetsOfClass,
        "investorType": retailMoneyMarketFlag,
        "minimumInitialInvestment": classInfo.minInitialInvestment,
        "wam": seriesLevelInfo.averagePortfolioMaturity,
        "wal": seriesLevelInfo.averageLifeMaturity,
        "reportDate": reportDate,
        "yield": yieldValue,
        "yieldDate": yieldDate,
    };
    for (let j = 0; j < investmentCategories.length; j++) {
        const value = investmentCategories[j].value;
        const name = investmentCategories[j].category;
        item[name] = ((item[name]) ? item[name] : 0) + (value / totalAssetsProcessed).toFixed(5) * 1;
    }
    item["USGO"] = (totalUSGO / totalAssetsProcessed).toFixed(5) * 1;
    item["Muni"] = (totalExempt / totalAssetsProcessed).toFixed(5) * 1;
    item.filingDate = filingDate;
    item.timestamp = timestamp;
    resp.push(item);
}

if (Array.isArray(classLevelInfo)) {
    for (let classIndex = 0; classIndex < classLevelInfo.length; classIndex++) {
        const classInfo = classLevelInfo[classIndex];
        processClassInfo(classInfo);
    }
} else {
    processClassInfo(classLevelInfo);
}
console.log(JSON.stringify(resp));