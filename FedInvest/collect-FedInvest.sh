#curl -sX POST -d "priceDateDay=2&priceDateMonth=10&priceDateYear=2025&fileType=csv" "https://treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail"
# retrieve the current date being reported (from the entry page)
if [ -n "$1" ]; then
    month=$(date +'%m' -d $1) || exit 1
    day=$(date +'%d' -d $1) || exit 1
    year=$(date +'%Y' -d $1) || exit 1
else
    curl -sSL "https://treasurydirect.gov/GA-FI/FedInvest/selectSecurityPriceDate" |
        grep 'priceDate.' >dateSource
    exitValue=$?
    dateLines=$(wc -l <dateSource)
    # exit if we don't have 3 date lines from the query
    if [ $exitValue ] && [ $dateLines = 3 ]; then
        month=$(
            grep "priceDate.month" dateSource |
                sed -e 's/^.*id="priceDate\.month" .*value="\([0-9]*\)".*$/\1/g'
        )
        day=$(
            grep "priceDate.day" dateSource |
                sed -e 's/^.*id="priceDate\.day" .*value="\([0-9]*\)".*$/\1/g'
        )
        year=$(
            grep "priceDate.year" dateSource |
                sed -e 's/^.*id="priceDate\.year" .*value="\([0-9]*\)".*$/\1/g'
        )

    else
        exit 1
    fi
fi
# create POST payload to retrieve that day's rates.
reportDate="$month\/$day\/$year"
postString="priceDateDay=$day&priceDateMonth=$month&priceDateYear=$year&fileType=csv"
# retrieve csv from site, and prepend reportDate to first column.
curl -sSX POST -d "$postString" "https://treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail" | sed -e "s/^/$reportDate,/"
exitValue=$?
rm -f dateSource
exit $exitValue
