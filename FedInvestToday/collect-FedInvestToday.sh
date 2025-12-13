#
# today search
#
tmpFile=curl.tmp
url="https://treasurydirect.gov/GA-FI/FedInvest/todaySecurityPriceDetail"
curl -sSL "$url" >$tmpFile
exitValue=$?
# get report date only if successful query for a date.
if [ $exitValue ] && grep 'Prices For:' $tmpFile >/dev/null; then
    reportDate=$(
        date +'%m\/%d\/%Y' -d "$(
            grep 'Prices For:' $tmpFile |
                sed -e 's/<h2>Prices For://' -e 's/<\/h2>//'
        )"
    )
    # retrieve csv from site, and prepend reportDate to first column.
    curl -sSLX POST --data "fileType=csv" "$url" | sed -e "s/^/$reportDate,/"
    exitValue=$?
fi
rm -f $tmpFile
exit $exitValue
