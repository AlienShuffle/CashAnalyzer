#!/usr/bin/bash
#
# computer-specific configurations.
source ../meta.$(hostname).sh

while [ -n "$1" ]; do
    ticker=$1
    shift

    if [ ! -n "$ticker" ]; then
        echo "ticker: missing argument"
        continue
    fi
    if [ ! -s "$fundsMetaFile" ]; then
        echo "$fundsMetaFile does not exist, exiting..."
        continue
    fi
    class=$(node ./node-ticker-CIK-map.js "$ticker" class <"$fundsMetaFile")
    if [ ! -n "$class" ]; then
        echo "$ticker: missing from $fundsMetaFile, skipping...."
       continue
    fi
    xmlFiles=$(grep "$class" ../EDGAR-d-MFP-lists/MFP-files/*/*.xml | cut -d: -f1 | sort -u)
    if [ ! -n "$xmlFiles" ]; then
        echo "$ticker: no xml files found, skipping..."
        continue
    fi
    count=$(echo $xmlFiles | wc -w)
    echo $count xml files found for $ticker.
    touch $xmlFiles
done