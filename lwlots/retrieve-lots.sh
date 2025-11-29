#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
tmpFile=street.html
(
    count=0
    firstRow=true
    echo "["
    cat street-names.csv |
        while IFS= read -r row; do
            [ "$firstRow" = "false" ] && echo ","
            street=$(echo $row | sed -e 's/ /%20/g')
            echo $row 1>&2
            url="https://gis.vgsi.com/SchuylkillCountyPA/Streets.aspx?Name=$street"
            #echo $url 1>&2
            curl -ksSL "$url" >"$tmpFile"
            [ $? -ne 0 ] && echo "Error retrieving $url" 1>&2 && exit 1
            # note, the return speed of the site is causing an issue with stdin.
            node ./node-lot-retrieval.js parcel-prefix.csv "$tmpFile"
            firstRow=false
            count=$(($count + 1))
            [ $count -ge 500 ] && break
        done
    echo "]"
) > lots.tmp.json
cat lots.tmp.json | jq -s 'flatten | unique_by(.lot) | sort_by(.lot)' > lots.json
cat lots.json | jq -r '.[] | [.lot,.pid,.parcel] | @csv' > lots.csv
# need to add export to cvs file, and get ready for delivery to the cloud.
rm -f lots.tmp.json $tmpFile
