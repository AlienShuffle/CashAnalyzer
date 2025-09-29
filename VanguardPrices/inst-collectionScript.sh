#!/usr/bin/bash
#
# Pull a recent history report for each Vanguard fund and assemble an array to feed into the processor.
#
if [ -n "$1" ]; then
    beginDate=$1'-01-01'
    endDate=$1'-12-31'
else
    beginDate=$(date +'%Y-01-01')
    endDate=$(date +'%Y-%m-%d')
fi
(
    firstRow=true
    echo "["
    while IFS= read -r row; do
       [ "$firstRow" = "false" ] && echo ","
       fundId=$(echo $row | cut -d, -f2)
       ticker=$(echo $row | cut -d, -f1)
       echo $ticker 1>&2
       url="https://institutional.vanguard.com/investments/yieldsServiceProxy?portIds=$(echo $fundId)&timePeriodCode=D&effectiveDate=$beginDate:to:$endDate&yieldCodes=1DISTYLD,CMPNDYLDPC,SEC,7DISTYLD,30DISTYLD"

      curl -sSL $url > tmp.json
        sed -e 's/\"yields\":{/\"ticker\":\"'$ticker'\", \"yields\": {/g' < tmp.json
        firstRow=false
    done
    echo "]"
) | jq .
