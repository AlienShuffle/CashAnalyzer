#curl -sX POST -d "priceDateDay=2&priceDateMonth=10&priceDateYear=2025&fileType=csv" "https://treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail"
# retrieve the current date being reported (from the entry page)
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
    reportDate="$month\/$day\/$year"
    # create POST payload to retrieve that day's rates.
    postString="priceDateDay=$day&priceDateMonth=$month&priceDateYear=$year&fileType=csv"

    # retrieve csv from site, and prepend reportDate to first column.
    curl -sSX POST -d "$postString" "https://treasurydirect.gov/GA-FI/FedInvest/securityPriceDetail" | sed -e "s/^/$reportDate,/"
    exitValue=$?
fi
rm -f dateSource
exit $exitValue
