#!/bin/bash

beginDate='2024-12-30'
endDate='2025-08-29'
#endDate=$(date +'%Y-%m-%d')
if [ -z "$1" ]; then
    #fundId="4391"
    fundId="0033"
else
    fundId="$1"
fi
offset=0
#
# valuation price history
# - offset works
#url="https://institutional.vanguard.com/investments/valuationPricesServiceProxy?timePeriodCode=D&portIds=$fundId&priceTypeCodes=MKTP,NAV,HIGH,LOW,SNAV&effectiveDate=$beginDate:to:$endDate&offset=$offset"
#
# fund price history
# - offset is not working.
url="https://institutional.vanguard.com/investments/fundPricesServiceProxy?priceTypeCodes=NAV&timePeriodCode=D&portIds=$fundId&effectiveDate=$beginDate:to:$endDate&offset=$offset"
# example: "https://institutional.vanguard.com/investments/fundPricesServiceProxy?priceTypeCodes=NAV&timePeriodCode=D&portIds=0033&effectiveDate=2024-08-31:to:2024-11-28"
# example: "https://institutional.vanguard.com/investments/fundPricesServiceProxy?priceTypeCodes=NAV&timePeriodCode=D&portIds=0033&effectiveDate=2024-08-31:to:2024-11-28"
#
# current Yield History
#url="https://institutional.vanguard.com/investments/yieldsServiceProxy?portIds=$fundId&timePeriodCode=D&effectiveDate=$beginDate:to:$endDate&yieldCodes=1DISTYLD,CMPNDYLDPC,SEC,7DISTYLD,30DISTYLD&offset=$offset"
#the next one works with 0033 (VMFXX)
url="https://institutional.vanguard.com/investments/yieldsServiceProxy?portIds=$fundId&timePeriodCode=D&effectiveDate=$beginDate:to:$endDate&yieldCodes=1DISTYLD,CMPNDYLDPC,SEC,7DISTYLD,30DISTYLD"

#url="https://institutional.vanguard.com/investments/yieldsServiceProxy?portIds=$fundId&timePeriodCode=D&effectiveDate=$beginDate:to:$endDate&yieldCodes=1DISTYLD"
#url="https://institutional.vanguard.com/investments/yieldsServiceProxy?portIds=$fundId&yieldCodes=1DISTYLD"
#
# current expense ratio
#url="https://institutional.vanguard.com/investments/feesExpenseServiceProxy?portIds=$fundId"
#
# distribution history
# sunday night, down.
#url="https://institutional.vanguard.com/investments/distributionsServiceProxy?portIds=$fundId&recordDate=$beginDate:to:$endDate"

echo $url 1>&2
#echo hit enter to continue...
#read line
curl -sSL $url > tmp.json
if [ "$(cat tmp.json)" = "Internal Server Error" ]; then
cat tmp.json 1>&2
echo 1>&2
rm -f tmp.json
exit 1
fi
jq . < tmp.json
rm -f tmp.json