#!/usr/bin/bash
#
# Pull a recent history report for each Vanguard fund and assemble an array to feed into the processor.
#
if [ -n "$1" ]; then
    beginDate=$1'-01-01'
    endDate=$1'-12-31'
    echo "Date Range: $beginDate to $endDate" 1>&2
else
    beginDate=$(date -d "30 days ago" +'%Y-%m-%d')
    endDate=$(date +'%Y-%m-%d')
fi

source ../meta.$(hostname).sh

(
    firstRow=true
    echo "["
    while IFS= read -r row; do
        [ "$firstRow" = "false" ] && echo ","
        fundId=$(echo $row | cut -d, -f2)
        ticker=$(echo $row | cut -d, -f1)
        [ -z "$ticker" ] && continue
        echo $ticker 1>&2
        url="https://institutional.vanguard.com/investments/yieldsServiceProxy?portIds=$(echo $fundId)&timePeriodCode=D&effectiveDate=$beginDate:to:$endDate&yieldCodes=1DISTYLD,CMPNDYLDPC,SEC,7DISTYLD,30DISTYLD"
        #echo $url 1>&2
        curl -sSL --header "$curlAgentHeader" "$url" | # tee curl.tmp.json |
            sed -e 's/\"yields\":{/\"ticker\":\"'$ticker'\", \"yields\": {/g'
        firstRow=false
    done
    echo "]"
) | jq .
