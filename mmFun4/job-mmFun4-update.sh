#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" | ../bin/mmFun-update-common-job.sh "$@"