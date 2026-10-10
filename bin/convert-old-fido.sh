#!/usr/bin/bash
source ../meta.common.sh
[ -d old-history ] || mkdir -p old-history
for i in $(cut -f1 -d, $(basename $PWD)-funds.csv); do
    if [ -d "$publishHome/MM/$i" ]; then
        newFile=old-history/$i.json
        find "$publishHome/MM/$i" -type f -name $i.json -print |
            while IFS= read -r file; do
                cat "$file"
            done |
            jq -s 'flatten ' >"$newFile.in"
        if node ../lib/node-convert-old-fido.js "$i" --input "$newFile.in" --output "$newFile"; then
            ../bin/MM-update-common-job.sh --injectProcessedJson "$newFile"
        else
            echo "failed to convert $i old fido history."
        fi
        rm -f "$newFile.in"
    fi
done
