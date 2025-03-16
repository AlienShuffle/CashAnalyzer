#!/usr/bin/bash
cat "$(basename $(pwd))-funds.csv" | ../bin/Fidelity-update-common-job.sh "$@"