#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=7-full-report
listTmpFile=$exportPrefix.tmp.json
node ./node-7-full-report.js 4-lot-normalized.json 3-lot-taxes.json 6-addr-list.json 5-owner-list.json |
    jq . >"$exportPrefix.json"
cat $exportPrefix.json | (
    echo "lot,gisLink,taxLink,location,useCode,lake,acres,livingArea,yearBuilt,relatedEmptyLots,relatedHomeLots,delinquent,previousDelinquency,valuationImprovePerSqft,valuationLandPerAcre,valuationTotal,saleDate,taxesDue,relatedLots,generalOwner,owners"
    jq -r '.[] | [.lot,.gisLink,.taxLink,.location,.propertyUseCode,.lake,.acres,.livingArea,.yearBuilt,.relatedEmptyLotCnt,.relatedHomeLotCnt,.delinquent,.previousDelinquency,.valuationImprovePerSqft,.valuationLandPerAcre,.valuationTotal,.saleDate,.taxStatus.taxesDue,(.relatedLots|join(";")),.generalOwner,(.owners|join(";"))] | @csv'
) >"$exportPrefix".csv
rm -f "$listTmpFile"
