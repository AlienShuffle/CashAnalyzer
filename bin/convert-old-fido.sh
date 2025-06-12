#!/usr/bin/bash
source ../meta.$(hostname).sh
[ -d old-history ] || mkdir -p old-history
for i in $(cut -f1 -d, $(basename $PWD)-funds.csv); do
    if [ -d "$publishHome/MM/$i" ]; then
        newFile=old-history/$i.json
        find "$publishHome/MM/$i" -type f -name $i.json -print |
            while IFS= read -r file; do
                cat "$file"
            done |
            jq -s 'flatten ' |
            node ../lib/node-convert-old-fido.js $i |
            jq . >"$newFile"
        ../bin/MM-update-common-job.sh --injectProcessedJson "$newFile"
    fi
done
