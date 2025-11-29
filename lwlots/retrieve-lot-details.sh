#!/usr/bin/bash
#
# Pull all the lots using a list of streets as the driver to collect them. uses parcel prefixes to filter out non LWPOA lots.
#
tmpFile=lot-detail.html
(
    count=0
    firstpid=true
    echo "["
    cat lots.csv |
        while IFS= read -r row; do
            [ "$firstpid" = "false" ] && echo ","
            pid=$(echo $row | cut -d',' -f2)
            echo $pid 1>&2
            url="https://gis.vgsi.com/SchuylkillCountyPA/Parcel.aspx?pid=$pid"
            #echo $url 1>&2
            curl -ksSL "$url" >"$tmpFile"
            [ $? -ne 0 ] && echo "Error retrieving $url" 1>&2 && exit 1
            # note, the return speed of the site is causing an issue with stdin.
            node ./node-lot-detail.js "$tmpFile"
            firstpid=false
            count=$(($count + 1))
            [ $count -ge 5 ] && break
        done
    echo "]"
) >lot-detail.tmp.json
cat lot-detail.tmp.json | jq -s 'flatten | unique_by(.lot) | sort_by(.lot)' >lots-detail.json
# need to add export to cvs file, and get ready for delivery to the cloud.
rm -f lot-detail.tmp.json $tmpFile
