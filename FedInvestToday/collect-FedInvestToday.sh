# Retrieve today's page first. Before prices are published, this page contains
# no export form and explicitly reports that prices are not available yet.
baseUrl="https://www.treasurydirect.gov/GA-FI/FedInvest"
cookieJar=$(mktemp)
sourceFile=$(mktemp)
csvFile=$(mktemp)
trap 'rm -f "$cookieJar" "$sourceFile" "$csvFile"' EXIT

curl -fsSL -A 'Mozilla/5.0' -c "$cookieJar" -b "$cookieJar" \
    "$baseUrl/todaySecurityPriceDetail" >"$sourceFile" || exit 1

# Exit 3 tells the common job that prices are simply not published (before
# 1:00 p.m. ET, or all day on a federal holiday when the same notice remains).
grep -qi 'Current day prices are not available' "$sourceFile" && exit 3

reportText=$(sed -n 's/.*<h2>Prices For:\s*\(.*\)<\/h2>.*/\1/p' "$sourceFile")
[ -n "$reportText" ] || exit 1
reportDate=$(date +'%m/%d/%Y' -d "$reportText") || exit 1

csrfToken=$(perl -0777 -ne '
    if (/name="_csrf"\s+value="([^"\s]*(?:\s+[^"\s]*)*)"/s) {
        $token = $1;
        $token =~ s/\s+//g;
        print $token;
        exit;
    }
' "$sourceFile")
[ -n "$csrfToken" ] || exit 1

# Retrieve CSV and prepend reportDate to its first column.
curl -fsS -A 'Mozilla/5.0' -c "$cookieJar" -b "$cookieJar" \
    -e "$baseUrl/todaySecurityPriceDetail" \
    --data-urlencode 'fileType=csv' \
    --data-urlencode "_csrf=$csrfToken" \
    "$baseUrl/todaySecurityPriceDetail" >"$csvFile" || exit 1
sed -e "s|^|$reportDate,|" "$csvFile"
