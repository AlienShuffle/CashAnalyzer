#!/usr/bin/bash
#
# Pull a recent history report for each Vanguard fund and assemble a csv (ticker:date:rate) array to feed into the processor.
#
beginDate='01%2F01%2F2025'
endDate=$(date +'%m%%2F%d%%2F%Y')
while IFS= read -r row; do
    fundId=$(echo $row | cut -d, -f2)
    ticker=$(echo $row | cut -d, -f1)
    curl -sSL "https://personal.vanguard.com/us/funds/tools/pricehistorysearch?radio=1&results=get&FundId=$(echo $fundId)&radiobutton2=1&beginDate=$beginDate&endDate=$endDate" |
        grep '</td><td>\$' |
        sed -e 's/^<tr class=\"[aw]r\"><td align=\"left\">/'$ticker':/g' |
        sed -e 's/<\/td><td>\$1.00<\/td><td class="nr">/:/g' |
        sed -e 's/<\/td><\/tr>$//g'
done
