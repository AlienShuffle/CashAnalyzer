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
            echo $url 1>&2
            curl -ksSL "$url" >"$tmpFile"
            cat $tmpFile | node ./node-lot-retrieval.js parcel-prefix.csv
            firstRow=false
            count=$(($count + 1))
            [ $count -ge 500 ] && break
        done
    echo "]"
) > lots.tmp.json
cat lots.tmp.json | jq -s 'flatten' > lots.json
rm -f $tmpFile
