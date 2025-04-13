#!/usr/bin/bash
for i in $(cat "$(basename $(pwd))-funds.csv"); do
    echo Querying: $i
    echo $i | ../bin/mmFun-update-common-job.sh "$@"
done
