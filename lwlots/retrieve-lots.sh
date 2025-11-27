#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
(
    count=0
    firstRow=true
    echo "["
    cat street-names.csv |
        while IFS= read -r row; do
            [ "$firstRow" = "false" ] && echo ","
            street=$(echo $row | sed -e 's/ /%20/g')
            echo $street 1>&2
            url="https://gis.vgsi.com/SchuylkillCountyPA/Streets.aspx?Name=$street"
            #echo $url 1>&2
            curl -ksSL "$url" # |
            #    node ./node-retrievel.js parcel-prefix.csv
            firstRow=false
            count=$(($count + 1))
            [ $count -ge 1 ] && break
        done
    echo "]"
) #| jq .
