#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=lot-detail
curlTmpFile=$exportPrefix.html
listTmpFile=$exportPrefix.tmp.json
(
    count=1
    firstpid=true
    echo "["
    cat lot-list.csv | # grep 625 |
        while IFS= read -r row; do
            pid=$(echo $row | cut -d',' -f2)
            [ "$pid" = "pid" ] && continue # skip header
            location=$(echo $row | cut -d',' -f4 | tr -d '"')
            [ "$firstpid" = "false" ] && echo ","
            echo $count $pid $location 1>&2
            url="https://gis.vgsi.com/SchuylkillCountyPA/Parcel.aspx?pid=$pid"
            #echo $url 1>&2
            curl -ksSL "$url" >"$curlTmpFile"
            [ $? -ne 0 ] && echo "Error retrieving $url" 1>&2 && exit 1
            # note, the return speed of the site is causing an issue with stdin.
            node ./node-$exportPrefix.js $curlTmpFile
            firstpid=false
            count=$(($count + 1))
            [ $count -ge 3150 ] && break
        done
    echo "]"
) >$listTmpFile
cat $listTmpFile | jq -s 'flatten | unique_by(.lot) | sort_by(.lot)' >$exportPrefix.json
cat $exportPrefix.json | (
    echo "lot,pid,parcel,location,generalOwner,address,acres,valuationImprove,valuationLand,valuationTotal,valuationYear,saleDate"
    jq -r '.[] | [.lot,.pid,.parcel,.location,.generalOwner,.address,.acres,.valuationImprove,.valuationLand,.valuationTotal,.valuationYear,.saleDate] | @csv'
) >$exportPrefix.csv
rm -f $listTmpFile $curlTmpFile
