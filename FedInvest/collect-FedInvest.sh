# retrieve the requested date and the CSRF token from the entry page.
baseUrl="https://www.treasurydirect.gov/GA-FI/FedInvest"
cookieJar=$(mktemp)
dateSource=$(mktemp)
detailSource=$(mktemp)
csvSource=$(mktemp)
trap 'rm -f "$cookieJar" "$dateSource" "$detailSource" "$csvSource"' EXIT

curl -fsSL -A 'Mozilla/5.0' -c "$cookieJar" -b "$cookieJar" \
    "$baseUrl/selectSecurityPriceDate" >"$dateSource" || exit 1

csrfToken=$(perl -0777 -ne '
    if (/name="_csrf"\s+value="([^"\s]*(?:\s+[^"\s]*)*)"/s) {
        $token = $1;
        $token =~ s/\s+//g;
        print $token;
        exit;
    }
' "$dateSource")
[ -n "$csrfToken" ] || exit 1

if [ -n "$1" ]; then
    selectedDate=$(date +'%Y-%m-%d' -d "$1") || exit 1
else
    selectedDate=$(sed -n 's/.*name="priceDate"[^>]*value="\([0-9-]*\)".*/\1/p' "$dateSource")
    [ -n "$selectedDate" ] || exit 1
fi

year=${selectedDate:0:4}
month=${selectedDate:5:2}
day=${selectedDate:8:2}
reportDate="$month/$day/$year"

# Select the date, then retrieve the detail page to obtain its export token.
curl -fsS -A 'Mozilla/5.0' -c "$cookieJar" -b "$cookieJar" \
    -e "$baseUrl/selectSecurityPriceDate" \
    --data-urlencode "priceDate=$selectedDate" \
    --data-urlencode 'submit=Show Prices' \
    --data-urlencode "_csrf=$csrfToken" \
    "$baseUrl/selectSecurityPriceDate" >/dev/null || exit 1
curl -fsSL -A 'Mozilla/5.0' -c "$cookieJar" -b "$cookieJar" \
    "$baseUrl/securityPriceDetail" >"$detailSource" || exit 1

csrfToken=$(perl -0777 -ne '
    if (/name="_csrf"\s+value="([^"\s]*(?:\s+[^"\s]*)*)"/s) {
        $token = $1;
        $token =~ s/\s+//g;
        print $token;
        exit;
    }
' "$detailSource")
[ -n "$csrfToken" ] || exit 1

# Retrieve CSV and prepend reportDate to its first column.
curl -fsS -A 'Mozilla/5.0' -c "$cookieJar" -b "$cookieJar" \
    -e "$baseUrl/securityPriceDetail" \
    --data-urlencode "priceDateDay=$day" \
    --data-urlencode "priceDateMonth=$month" \
    --data-urlencode "priceDateYear=$year" \
    --data-urlencode 'fileType=csv' \
    --data-urlencode "_csrf=$csrfToken" \
    "$baseUrl/securityPriceDetail" >"$csvSource" || exit 1
sed -e "s|^|$reportDate,|" "$csvSource"
