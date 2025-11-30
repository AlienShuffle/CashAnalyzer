#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
exportPrefix=lot-list
curlTmpFile=$exportPrefix.html
listTmpFile=$exportPrefix.tmp.json
(
    count=0
    firstRow=true
    echo "["
    cat meta-streets.csv | # grep WYNONAH |
        while IFS= read -r row; do
            [ "$firstRow" = "false" ] && echo ","
            street=$(echo $row | sed -e 's/ /%20/g')
            echo $row 1>&2
            url="https://gis.vgsi.com/SchuylkillCountyPA/Streets.aspx?Name=$street"
            #echo $url 1>&2
            curl -ksSL "$url" >"$curlTmpFile"
            [ $? -ne 0 ] && echo "Error retrieving $url" 1>&2 && exit 1
            # note, the return speed of the site is causing an issue with stdin.
            node ./node-$exportPrefix.js meta-parcel-prefixes.csv $curlTmpFile
            firstRow=false
            count=$(($count + 1))
            [ $count -ge 500 ] && break
        done
    echo "]"
) >"$listTmpFile"
cat "$listTmpFile" | jq -s 'flatten | unique_by(.lot) | sort_by(.lot)' >$exportPrefix.json
cat $exportPrefix.json | (
    echo "lot,pid,parcel,location"
    jq -r '.[] | [.lot,.pid,.parcel,.location] | @csv'
) >"$exportPrefix".csv
rm -f "$listTmpFile" "$curlTmpFile"
