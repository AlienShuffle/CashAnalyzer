import { duGetISOString } from "../lib/dateUtils.mjs";
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import process from 'node:process';

// read HTML from file given as 1st argument, this is a parcel detail report from the county GIS site.
const htmlString = readFileSync(process.argv[2], 'utf8');
const root = parse(htmlString);

const getText = (selector, fallback = '', required = false) => {
    const node = root.querySelector(selector);
    if (!node) {
        if (required) {
            console.error(`Missing required selector ${selector} in ${process.argv[2]}`);
        }
        return fallback;
    }
    return node.text.trim();
};

const parseNumber = (value) => {
    if (!value) return null;
    const normalized = value.replace(/[^0-9.\-]/g, '');
    return normalized.length ? Number(normalized) : null;
};

const fawnLots = new Set(readFileSync('meta/lots-fawn.txt', 'utf8').trim().split('\n').map(line => parseInt(line.trim(), 10)));
const wynonahLots = new Set(readFileSync('meta/lots-wynonah.txt', 'utf8').trim().split('\n').map(line => parseInt(line.trim(), 10)));

const parcelStringRaw = getText('#MainContent_lblMblu', '', true)
    .replace(/^.*Mblu:/, '')
    .replace(/[\s\n\r]/g, '')
    .trim()
    .replace(/\/$/, '')
    .replace(/\//g, '-');
const parcelStringSplit = parcelStringRaw.split('-');
const lotString = parcelStringSplit[2] || '';
const pidString = getText('#MainContent_lblPid', '', true);
const parcelString = `${parcelStringSplit[0] || ''}-${parcelStringSplit[1] || ''}-${lotString}.${parcelStringSplit[3] || ''}`;
const locationString = getText('#MainContent_lblLocation', '', true);

const generalOwnerString = getText('#MainContent_lblGenOwner', '', true);

const propertyTypeString = getText('#MainContent_lblPbn', '', true);
const propertyUseCode = parseNumber(getText('#MainContent_lblUseCode2', '', true));
const propertyAssessment = getText('#MainContent_lblGenAssessment', '', true);

const addressString = getText('#MainContent_lblAddr1', '', true);
const acresString = getText('#MainContent_lblLndSize');

// list of co-owners retrieval
const ownersRootElement = root.querySelector('#MainContent_grdSales');
if (!ownersRootElement) {
    console.error(`Missing required owners table #MainContent_grdSales in ${process.argv[2]}`);
}
const defaultOwnersRow = ownersRootElement?.children?.[2];
const ownersString = defaultOwnersRow?.children?.[0]?.text || '';
const owners = ownersString
    .split(';')
    .map(name => name.trim())
    .filter(name => name.length > 0);
const salePriceString = defaultOwnersRow?.children?.[1]?.text || '';
const saleDateString = new Date(defaultOwnersRow?.children?.[4]?.text || '');
const previousOwners = [];
//console.error(`Found ${ownersRootElement?.children?.length || 0} previous owners.`);
if (ownersRootElement?.children?.length > 3) {
    for (let j = 3; j < ownersRootElement.children.length; j++) {
        const previousOwnerString = ownersRootElement.children[j]?.children?.[0]?.text || '';
        const previousSalesPriceString = ownersRootElement.children[j]?.children?.[1]?.text || '';
        const previousSaleDateString = new Date(ownersRootElement.children[j]?.children?.[4]?.text || '');
        previousOwners.push(
            {
                owners: previousOwnerString
                    .split(';')
                    .map(name => name.trim())
                    .filter(name => name.length > 0),
                salePrice: parseNumber(previousSalesPriceString),
                saleDate: duGetISOString(previousSaleDateString)
            }
        );
    }
}

// latest valuations table retrieval
const valuationRootElement = root.querySelector('#MainContent_grdCurrentValueAsmt');
if (!valuationRootElement) {
    console.error(`Missing required valuation table #MainContent_grdCurrentValueAsmt in ${process.argv[2]}`);
}
const valuationSectionElement = valuationRootElement?.children?.[2];
const valuationYearString = valuationSectionElement?.children?.[0]?.text || '';
const valuationImproveString = valuationSectionElement?.children?.[1]?.text || '';
const valuationLandString = valuationSectionElement?.children?.[2]?.text || '';
const valuationTotalString = valuationSectionElement?.children?.[3]?.text || '';

const yearBuilt = getText('#MainContent_ctl02_lblYearBuilt');
const livingAreaString = getText('#MainContent_ctl02_lblBldArea');

const result = {
    lot: lotString * 1,
    pid: pidString * 1,
    parcel: parcelString,
    location: locationString,
    propertyType: propertyTypeString,
    propertyUseCode: propertyUseCode,
    assessment: propertyAssessment.replace(/[\$,]/g, '') * 1,
    address: addressString.trim(),
    acres: acresString * 1,
    lake: fawnLots.has(lotString * 1) ? 'F' : wynonahLots.has(lotString * 1) ? 'W' : null,
    yearBuilt: (yearBuilt * 1) || null,
    livingArea: (livingAreaString.replace(/[\s,]/g, '') * 1) || null,
    generalOwner: generalOwnerString,
    salePrice: salePriceString.replace(/[\$,]/g, '') * 1,
    saleDate: duGetISOString(saleDateString),
    owners: owners,
    previousOwners: previousOwners,
    valuationYear: valuationYearString * 1,
    valuationImprove: valuationImproveString.replace(/[\$,]/g, '') * 1,
    valuationLand: valuationLandString.replace(/[\$,]/g, '') * 1,
    valuationTotal: valuationTotalString.replace(/[\$,]/g, '') * 1,
    timestamp: new Date
}

console.log(JSON.stringify(result));