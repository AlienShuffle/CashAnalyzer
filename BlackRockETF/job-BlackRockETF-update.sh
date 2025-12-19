#!/usr/bin/bash
cat BlackRock-ETFs.csv |
    while IFS= read -r fundReference; do
    ticker=$(echo "$fundReference" | cut -d, -f1)
    echo "$fundReference" |
     ../bin/ETF-distro-update-common-job.sh --ticker "$ticker" "$@"
    done
