#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#

# good test cases
# 0008 - currently delinquent 2025 only, balance 909.96
# 0057 - CS (18-25) balance 0
# 0625 - current taxes
# 0791 - RS (90-25) balance 0
# 0743 - delinquent (2024-2025) balance 6843.34

exportPrefix=lot-taxes
curlTmpFile=$exportPrefix.html
listTmpFile=$exportPrefix.tmp.json
(
    count=1
    firstparcel=true
    echo "["
    cat lot-list.csv | #grep 0008 |
        while IFS= read -r row; do
            parcel=$(echo $row | cut -d',' -f3 | tr -d '"')
            [ "$parcel" = "parcel" ] && continue # skip header
            location=$(echo $row | cut -d',' -f4 | tr -d '"')
            [ "$firstparcel" = "false" ] && echo ","
            echo $count $parcel $location 1>&2
            url="https://eliterevenue.rba.com/taxes/schuylkill/trirsp2pp.asp?parcel=$parcel+++++++++++&currentlist=0&"
            #echo $url 1>&2
            curl -ksSL "$url" >"$curlTmpFile"
            [ $? -ne 0 ] && echo "Error retrieving $url" 1>&2 && exit 1
            # note, the return speed of the site is causing an issue with stdin.
            node ./node-$exportPrefix.js "$curlTmpFile" "$parcel"
            firstparcel=false
            count=$(($count + 1))
            [ $count -ge 3100 ] && break
        done
    echo "]"
) >$listTmpFile
cat $listTmpFile | jq -s 'flatten | unique_by(.lot) | sort_by(.lot)' >$exportPrefix.json
cat $exportPrefix.json | (
    echo "lot,parcel,location,owners,address,assessment,delinquent,taxesDue,previousDelinquency,firstDeliquentYear,lastDeliquentYear,historicalDelinquency,saleType"
    jq -r '.[] | [.lot,.parcel,.location,.owners,.address,.assessment,.delinquent,.status.taxesDue,.previousDelinquency,.status.firstDeliquentYear,.status.lastDeliquentYear,.status.historicalDelinquency,.status.saleType] | @csv'
) >$exportPrefix.csv
rm -f $listTmpFile $curlTmpFile
