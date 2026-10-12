#!/usr/bin/bash
# don't run more often then every 15 minutes. The site has rate limiting.
lastRunFile="./history/VanguardAdvisors-facts-new.json"
if [ -f "$lastRunFile" ] && [ $(find "$lastRunFile" -mmin -15 -print | wc -l) -gt 0 ]; then
    echo "too soon!" 1>&2
    exit 1
fi

cat ./VanguardETF-funds.txt |
    while read -r ticker; do
        [ ! -z "$ticker" ] || continue
        [ -d "./downloads/$ticker" ] || mkdir -p "./downloads/$ticker"
        # only process if not downloaded in last 1 hour - -mmin -60 finds files modified in last 1 hour.
        recent=$(find "./downloads/$ticker" -type f -name "*.csv" -mmin -60 -print | wc -l)
        if [ $recent -gt 0 ]; then
            echo "$ticker, $recent files downloaded < 1 hour ago, skipping." 1>&2
            continue
        fi
        if [ -f "./history/$ticker/facts-new.json" ]; then
            echo "$(date -r history/$ticker/facts-new.json "+%Y-%m-%d %H:%M:%S"),$ticker"
        else
            echo "2020-01-01 02:00:00,$ticker"
        fi
    done |
    sort | tee dated-list.txt |
    # just get the 10 tickers with the oldest download times, and skip the date
    cut -d, -f2- | head