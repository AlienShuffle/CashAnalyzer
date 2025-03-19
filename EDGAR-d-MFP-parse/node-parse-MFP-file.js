import { XMLParser } from 'fast-xml-parser';
import { XMLValidator } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

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
        if (fundList[i].cik == cik && fundList[i].series == series, fundList[i].class == classId)
            return fundList[i];
    }
    return '';
}

// take the fund CIK,fiscalyear table and injest as well.
const fiscalYearBuffer = readFileSync(process.argv[3], 'utf8');
const fiscalYears = fiscalYearBuffer.split('\n');
function findFiscalYear(cik) {
    for (let i = 0; i < fiscalYears.length; i++) {
        if (fiscalYears[i].indexOf(cik) > -1) {
            const vals = fiscalYears[i].split(',');
            return vals[1];
        }
    }
}
// read in the MFP XML file from stdin.
const xmlFile = readFileSync(0, 'utf8');
// validate the file to know it will parse.
const result = XMLValidator.validate(xmlFile);
if (result.err) throw "XML invalid: " + result.err.msg

// parse the XML into Javascript object tree (like normal JSON from a Javascript perspective)
const parser = new XMLParser();
const json = parser.parse(xmlFile);

// get header data about the fund.
const headerData = json.edgarSubmission.headerData;
const submissionType = headerData.submissionType;
const cik = headerData.filerInfo.filer.filerCredentials.cik;
const fiscalYear = findFiscalYear(cik);

const formData = json.edgarSubmission.formData;
const reportDate = formData.generalInfo.reportDate;
const seriesId = formData.generalInfo.seriesId;
const registrantFullName = formData.generalInfo.registrantFullName;
const nameOfSeries = formData.generalInfo.nameOfSeries;

const seriesLevelInfo = formData.seriesLevelInfo;
const moneyMarketFundCategory = (submissionType == 'N-MFP2') ?
    seriesLevelInfo.moneyMarketFundCategory[0] :
    seriesLevelInfo.moneyMarketFundCategory;
const retailMoneyMarketFlag = (submissionType == 'N-MFP2') ?
    ((seriesLevelInfo.fundExemptRetailFlag.toUpperCase() == 'N') ? 'Institutional' : 'Retail') :
    ((seriesLevelInfo.fundRetailMoneyMarketFlag.toUpperCase() == 'N') ? 'Institutional' : 'Retail')

const classLevelInfo = formData.classLevelInfo;

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
    { // MFP-3
        "value": 0,
        "treatment": "other",
        "category": "financialCompanyCommercialPaper",
        "EDGAR": "Financial Company Commercial Paper"
    },
    { // MFP-2
        "value": 0,
        "treatment": "other",
        "category": "financialCompanyCommercialPaper",
        "EDGAR": "Investment Company"
    },
    {
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
let resp = [];
for (let classIndex = 0; classIndex < classLevelInfo.length; classIndex++) {
    const classInfo = classLevelInfo[classIndex];
    // let's find out if this class is one we want to report.
    const classesId = classInfo.classesId;
    const match = findFund(cik, seriesId, classesId);
    if (!match) continue;

    // Get Fund Ticker Name as close as practical.
    const name = titleCase(registrantFullName + ' ' + nameOfSeries + ' ' + classInfo.classFullName + ' Shares');

    // Find the last 7 day yield published on this report.
    const sevenDayYields = classInfo.sevenDayNetYield;
    const yieldValue = (submissionType == 'N-MFP2') ?
        classInfo.sevenDayNetYield :
        classInfo.sevenDayNetYield[sevenDayYields.length - 1].sevenDayNetYieldValue;
    const yieldDate = (submissionType == 'N-MFP2') ?
        reportDate :
        classInfo.sevenDayNetYield[sevenDayYields.length - 1].sevenDayNetYieldDate;

    // only process assets once and only if we have a class match.
    if (!totalAssetsProcessed) {
        for (let i = 0; i < scheduleOfPortfolioSecuritiesInfo.length; i++) {
            const category = getCategory(scheduleOfPortfolioSecuritiesInfo[i].investmentCategory);
            const value = scheduleOfPortfolioSecuritiesInfo[i].includingValueOfAnySponsorSupport * 1;
            investmentCategories[category].value += value;
            if (investmentCategories[category].treatment == 'USGO') totalUSGO += value;
            totalAssetsProcessed += value;
        }
    }

    // create and export the resulting ticker symbol EDGAR report.
    let item = {
        "ticker": match.ticker,
        "source": "parse-MFP-files.sh",
        "name": name,
        "seriesName": nameOfSeries,
        "className": classInfo.classFullName,
        "expenseRatio": 0, // where do I find this?
        "fiscalYearEnd": fiscalYear,
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
    resp.push(item);
}
console.log(JSON.stringify(resp));