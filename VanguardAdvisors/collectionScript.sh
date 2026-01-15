#!/usr/bin/bash
# don't run more often then every 15 minutes. The site has rate limiting.
[ $(find "./history/VanguardAdvisors-rate-new.json" -mmin -15 -print | wc -l) -gt 0 ] &&
    echo "too soon!" 1>&2 &&
    exit 1

while read -r ticker; do
    [ ! -z "$ticker" ] || continue
    [ -d "./downloads/$ticker" ] || mkdir -p "./downloads/$ticker"
    # only process if not downloaded in last 24 hours - -mmin -1440 finds files modified in last 24 hour.
    recent=$(find "./downloads/$ticker" -type f -name "*.csv" -mmin -1440 -print | wc -l)
    if [ $recent -gt 0 ]; then
        #echo "$ticker, $recent files downloaded < 24 hours ago, skipping." 1>&2
        continue
    fi
    echo $ticker
done |
    node ./node-advisors-scrape.js | jq .
