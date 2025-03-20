#!/usr/bin/bash
#
# This processes the list of EDGAR submissions files and pulls out a list of
# MFP reports eligible for processing.
#
# process the command argument list.
pubDelayHours=48
runDelayHours=24
accountClass=EDGAR
while [ -n "$1" ]; do
    case $1 in
    "--accountClass")
        accountClass="$2"
        #echo "accountClass=$accountClass"
        shift
        ;;
    "-f")
        forceRun=true
        #echo "forceRun=$forceRun"
        ;;
    "--pubDelay")
        pubDelayHours="$2"
        #echo "pubDelayHours=$pubDelayHours"
        shift
        ;;
    "--runDelay")
        runDelayHours="$2"
        #echo "runDelayHours=$runDelayHours"
        shift
        ;;
    *)
        echo "Parameter $1 ignored"
        shift
        ;;
    esac
    shift
done
# computer-specific configurations.
source ../meta.$(hostname).sh

CIKmap="../EDGAR-a-CIK/CIK/company-map.json"
if [ ! -s "$CIKmap" ]; then
    echo "$CIKmap does not exist, exiting..."
    exit 1
fi
fundList="../mmFunCurr/mmFunCurr-funds.txt"
if [ ! -s "$fundList" ]; then
    echo "$fundList does not exist, exiting..."
    exit 1
fi
[ -d tickers ] || mkdir -p tickers

cat $fundList |
    while read -r ticker; do
        cik=$(node ./node-ticker-CIK-map.js "$ticker" <"$CIKmap")
        if [ ! -n "$cik" ]; then
            echo "$ticker: missing from CIK-map, skipping...."
            continue
        fi
        #echo "processing $ticker => $cik"
        cikDir="reports/$cik"
        if [ ! -d "$cikDir" ]; then
            echo "$cik: no reports published, skipping..."
            continue
        fi
        tickerFile="tickers/$ticker.json"

        # continue if file exists, no new files, and force not specified.
        [ -s "$tickerFile" ] &&
            [ "$(find "$cikDir" -type f -newer "$tickerFile" -print | wc -l)" -eq "0" ] &&
            [ ! -n "$forceRun" ] &&
            continue

        #echo "updating $ticker..."
        find "$cikDir" -type f -exec cat {} \; |
            jq -s "flatten | [.[] | select(.ticker==\"$ticker\")]" >tmp.json
        node ./sortReportDate.js <tmp.json |
            jq . >$tickerFile

        tickerDir="$cloudFlareHome/$accountClass/$ticker/"
        [ -d "$tickerDir" ] || mkdir -p "$tickerDir"

        jsonFlare="$cloudFlareHome/$accountClass/$ticker/EDGAR-$ticker-reports.json"
        csvFlare="$cloudFlareHome/$accountClass/$ticker/EDGAR-$ticker-reports.csv"

        if ../bin/jsonDifferent.sh "$tickerFile" "$jsonFlare"; then
            cat "$tickerFile" >"$jsonFlare"
            echo "published updated $ticker EDGAR cloudFlare history file."
            (
                echo 'ticker,source,registrantName,seriesName,className,expenseRatio,fiscalYearEnd,category,totalNetAssets,investorType,minimumInitialInvestment,wam,wal,reportDate,yield,yieldDate,usTreasuryDebt,usGovernmentAgencyDebt,usGovernmentAgencyCouponDebt,usGovernmentAgencyZeroCouponDebt,nonUSSovereignDebt,certificateofDeposit,nonNegotiableTimeDeposit,variableRateDemandNote,otherMunicipalSecurity,assetBackedCommercialPaper,otherAssetBackedSecurities,usTreasuryRepurchaseAgreement,usGovernmentAgencyRepurchaseAgreement,otherRepurchaseAgreement,insuranceCompanyFundingAgreement,financialCompanyCommercialPaper,nonFinancialCompanyCommercialPaper,tenderOptionBond,otherInstrument,USGO'
                jq -r '.[] | [.ticker,.source,.registrantName,.seriesName,.className,.expenseRatio,.fiscalYearEnd,.category,.totalNetAssets,.investorType,.minimumInitialInvestment,.wam,.wal,.reportDate,.yield,.yieldDate,.usTreasuryDebt,.usGovernmentAgencyDebt,.usGovernmentAgencyCouponDebt,.usGovernmentAgencyZeroCouponDebt,.nonUSSovereignDebt,.certificateofDeposit,.nonNegotiableTimeDeposit,.variableRateDemandNote,.otherMunicipalSecurity,.assetBackedCommercialPaper,.otherAssetBackedSecurities,.usTreasuryRepurchaseAgreement,.usGovernmentAgencyRepurchaseAgreement,.otherRepurchaseAgreement,.insuranceCompanyFundingAgreement,.financialCompanyCommercialPaper,.nonFinancialCompanyCommercialPaper,.tenderOptionBond,.otherInstrument,.USGO] | @csv' "$jsonFlare"
            ) >"$csvFlare"
            #echo "published updated cloudflare csv file."
        fi

    done
rm -f tmp.json
exit 0
