#
#beginDate='01%2F01%2F2025'
beginDate='04%2F30%2F2025'
endDate='05%2F21%2F2025'
#endDate=$(date +'%m%%2F%d%%2F%Y')
if [ -z "$1" ]; then
    fundId="4391"
else
    fundId="$1"
fi

echo "https://personal.vanguard.com/us/funds/tools/pricehistorysearch?radio=1&results=get&FundId=$(echo $fundId)&radiobutton2=1&beginDate=$beginDate&endDate=$endDate"
#echo hit enter to continue...
#read line
curl -sSL "https://personal.vanguard.com/us/funds/tools/pricehistorysearch?radio=1&results=get&FundId=$(echo $fundId)&radiobutton2=1&beginDate=$beginDate&endDate=$endDate"
