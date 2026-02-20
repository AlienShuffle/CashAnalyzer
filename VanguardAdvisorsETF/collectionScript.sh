#!/usr/bin/bash
# don't run more often then every 15 minutes. The site has rate limiting.
if [ $(find "./history/VanguardAdvisors-rate-new.json" -mmin -15 -print | wc -l) -gt 0 ]; then
    echo "too soon!" 1>&2
    exit 1
fi

cat ./VanguardETF-funds.txt |
    while read -r ticker; do
        [ ! -z "$ticker" ] || continue
        [ -d "./downloads/$ticker" ] || mkdir -p "./downloads/$ticker"
        # only process if not downloaded in last 12 hours - -mmin -720 finds files modified in last 12 hours.
        recent=$(find "./downloads/$ticker" -type f -name "*.csv" -mmin -720 -print | wc -l)
        if [ $recent -gt 0 ]; then
            #echo "$ticker, $recent files downloaded < 12 hours ago, skipping." 1>&2
            continue
        fi
        if [ -f "./history/$ticker/rate-new.json" ]; then
            echo "$(date -r history/$ticker/rate-new.json "+%m-%d-%Y %H:%M:%S"),$ticker"
        else
            echo "01-01-2020 02:00:00,$ticker"
        fi
    done |
    sort | tee dated-list.txt |
    # just get the 10 tickers with the oldest download times, and skip the date
    cut -d, -f2- | head |
    node ./node-advisors-scrape.js | jq .
